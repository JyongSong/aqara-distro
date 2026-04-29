import { NextRequest, NextResponse } from 'next/server'
import { getErpPool } from '@/lib/erp'
import sql from 'mssql'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dateTo   = searchParams.get('to')   || new Date().toISOString().slice(0, 10)
  const partnerCode = process.env.ERP_PARTNER_CODE || '1301495576'

  try {
    const pool = await getErpPool()
    const result = await pool.request()
      .input('dateFrom',     sql.VarChar(10), dateFrom)
      .input('dateTo',       sql.VarChar(10), dateTo)
      .input('partnerCode',  sql.VarChar(50), partnerCode)
      .query(`
        SELECT
          H.NO_GIR                        AS req_no,
          CONVERT(VARCHAR(10), CONVERT(DATE, H.DT_GIR), 111) AS req_date,
          L.NO_SO                         AS so_no,
          SOH.NO_PO_PARTNER               AS po_partner,
          SOL.NO_ORDER_ON                 AS online_order_no,
          I.NM_ITEM                       AS item_name,
          L.CD_ITEM                       AS item_code,
          CAST(L.QT_GIR AS INT)           AS qty_req,
          CAST(L.QT_GI  AS INT)           AS qty_shipped,
          CAST(L.QT_GIR - L.QT_GI AS INT) AS qty_pending,
          NULLIF(LTRIM(RTRIM(CZ.NO_SONG)),     '') AS cz_tracking_no,
          NULLIF(LTRIM(RTRIM(CZ.CD_DLV_SHOP)), '') AS carrier_code,
          NULLIF(LTRIM(RTRIM(CZ.NM_RECEIVE)),  '') AS recipient_name,
          (SELECT TOP 1 NULLIF(LTRIM(RTRIM(P.NO_SONG)), '')
           FROM NEOE.CZ_PU_INOUT_CONF_PROC P
           WHERE P.NO_RCV = H.NO_GIR AND P.CD_COMPANY = H.CD_COMPANY
             AND NULLIF(LTRIM(RTRIM(P.NO_SONG)), '') IS NOT NULL) AS proc_song,
          (SELECT TOP 1 NULLIF(LTRIM(RTRIM(P.DC_RMK)), '')
           FROM NEOE.CZ_PU_INOUT_CONF_PROC P
           WHERE P.NO_RCV = H.NO_GIR AND P.CD_COMPANY = H.CD_COMPANY
             AND NULLIF(LTRIM(RTRIM(P.DC_RMK)), '') IS NOT NULL)  AS proc_rmk,
          CASE CAST(DLV2.TP_DLV AS VARCHAR)
            WHEN '1'  THEN '택배'
            WHEN '2'  THEN '퀵서비스'
            WHEN '4'  THEN '고객사직접수령'
            WHEN '5'  THEN '직접배송(아카라)'
            WHEN '99' THEN '기타'
            ELSE CAST(DLV2.TP_DLV AS VARCHAR)
          END                             AS delivery_method,
          PA.LN_PARTNER                   AS partner_name
        FROM NEOE.SA_GIRH H
        JOIN NEOE.SA_GIRL L
          ON H.NO_GIR = L.NO_GIR AND H.CD_COMPANY = L.CD_COMPANY
        LEFT JOIN NEOE.MA_PITEM I
          ON L.CD_ITEM = I.CD_ITEM AND I.CD_COMPANY = '1000'
        LEFT JOIN NEOE.MA_PARTNER PA
          ON H.CD_PARTNER = PA.CD_PARTNER AND H.CD_COMPANY = PA.CD_COMPANY
        LEFT JOIN NEOE.SA_SOH SOH
          ON L.NO_SO = SOH.NO_SO AND L.CD_COMPANY = SOH.CD_COMPANY AND SOH.NO_HST = 0
        LEFT JOIN NEOE.SA_SOL SOL
          ON L.NO_SO = SOL.NO_SO AND L.SEQ_SO = SOL.SEQ_SO AND L.CD_COMPANY = SOL.CD_COMPANY AND SOL.NO_HST = 0
        LEFT JOIN NEOE.SA_SOL_DLV DLV2
          ON L.NO_SO = DLV2.NO_SO AND L.SEQ_SO = DLV2.SEQ_SO AND L.CD_COMPANY = DLV2.CD_COMPANY
        LEFT JOIN NEOE.CZ_SA_ORDER CZ
          ON L.NO_SO = CZ.NO_ORDER AND L.SEQ_SO = CZ.SEQ_ORDER AND L.CD_COMPANY = CZ.CD_COMPANY
        WHERE H.CD_COMPANY = '1000'
          AND H.CD_PARTNER = @partnerCode
          AND H.DT_GIR >= @dateFrom
          AND H.DT_GIR <= @dateTo
          AND ISNULL(H.YN_RETURN, 'N') = 'N'
        ORDER BY H.DT_GIR DESC, H.NO_GIR, L.SEQ_GIR
      `)

    // 송장번호: CZ_PU_INOUT_CONF_PROC(NO_GIR 직접 조회) 우선, 없으면 CZ_SA_ORDER
    const data = result.recordset.map(row => {
      const seen = new Set<string>()
      const addNums = (raw: string | null) => {
        if (!raw) return
        raw.split('/').forEach(part => {
          const d = part.replace(/\D/g, '')
          if (d.length >= 8) seen.add(d)
        })
      }
      addNums(row.proc_song)
      addNums(row.proc_rmk)
      if (seen.size === 0) addNums(row.cz_tracking_no)

      return {
        req_no:          row.req_no,
        req_date:        row.req_date,
        so_no:           row.so_no,
        po_partner:      row.po_partner,
        online_order_no: row.online_order_no,
        item_name:       row.item_name,
        item_code:       row.item_code,
        qty_req:         row.qty_req,
        qty_shipped:     row.qty_shipped,
        qty_pending:     row.qty_pending,
        tracking_no:     seen.size > 0 ? Array.from(seen).join('\n') : null,
        carrier_code:    row.carrier_code,
        delivery_method: row.delivery_method,
        recipient_name:  row.recipient_name ?? null,
        partner_name:    row.partner_name,
      }
    })

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'ERP 연결 실패'
    console.error('[ERP shipments]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

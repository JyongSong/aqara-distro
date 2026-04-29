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
          NULLIF(LTRIM(RTRIM(CZ.NO_SONG)), '')    AS tracking_no,
          NULLIF(LTRIM(RTRIM(CZ.CD_DLV_SHOP)), '') AS carrier_code,
          CASE CAST(DLV.TP_DLV AS VARCHAR)
            WHEN '1'  THEN '택배'
            WHEN '2'  THEN '퀵서비스'
            WHEN '4'  THEN '고객사직접수령'
            WHEN '5'  THEN '직접배송(아카라)'
            WHEN '99' THEN '기타'
            ELSE CAST(DLV.TP_DLV AS VARCHAR)
          END                             AS delivery_method,
          P.LN_PARTNER                    AS partner_name
        FROM NEOE.SA_GIRH H
        JOIN NEOE.SA_GIRL L
          ON H.NO_GIR = L.NO_GIR AND H.CD_COMPANY = L.CD_COMPANY
        LEFT JOIN NEOE.MA_PITEM I
          ON L.CD_ITEM = I.CD_ITEM AND I.CD_COMPANY = '1000'
        LEFT JOIN NEOE.MA_PARTNER P
          ON H.CD_PARTNER = P.CD_PARTNER AND H.CD_COMPANY = P.CD_COMPANY
        LEFT JOIN NEOE.SA_SOH SOH
          ON L.NO_SO = SOH.NO_SO AND L.CD_COMPANY = SOH.CD_COMPANY AND SOH.NO_HST = 0
        LEFT JOIN NEOE.SA_SOL SOL
          ON L.NO_SO = SOL.NO_SO AND L.SEQ_SO = SOL.SEQ_SO AND L.CD_COMPANY = SOL.CD_COMPANY AND SOL.NO_HST = 0
        LEFT JOIN NEOE.SA_SOL_DLV DLV
          ON L.NO_SO = DLV.NO_SO AND L.SEQ_SO = DLV.SEQ_SO AND L.CD_COMPANY = DLV.CD_COMPANY
        LEFT JOIN NEOE.CZ_SA_ORDER CZ
          ON L.NO_SO = CZ.NO_ORDER AND L.SEQ_SO = CZ.SEQ_ORDER AND L.CD_COMPANY = CZ.CD_COMPANY
        WHERE H.CD_COMPANY = '1000'
          AND H.CD_PARTNER = @partnerCode
          AND H.DT_GIR >= @dateFrom
          AND H.DT_GIR <= @dateTo
          AND ISNULL(H.YN_RETURN, 'N') = 'N'
        ORDER BY H.DT_GIR DESC, H.NO_GIR, L.SEQ_GIR
      `)

    return NextResponse.json({ data: result.recordset })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'ERP 연결 실패'
    console.error('[ERP shipments]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

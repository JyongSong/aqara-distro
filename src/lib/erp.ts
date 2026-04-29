import sql from 'mssql'

const config: sql.config = {
  server: process.env.ERP_SERVER!,
  port: Number(process.env.ERP_PORT) || 2023,
  database: 'NEOE',
  user: process.env.ERP_USER!,
  password: process.env.ERP_PASSWORD!,
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
  connectionTimeout: 10000,
  requestTimeout: 20000,
}

// Reuse pool across warm serverless invocations
let _pool: sql.ConnectionPool | null = null

export async function getErpPool(): Promise<sql.ConnectionPool> {
  if (_pool?.connected) return _pool
  _pool = await new sql.ConnectionPool(config).connect()
  return _pool
}

/**
 * NO_SONG / DC_RMK 에서 숫자만 추출하여 중복 제거 후 줄바꿈으로 합침
 * DC_RMK 형식: "462165832181/462165832192/텍스트 ..."
 */
function extractTrackingNumbers(noSong: string | null, dcRmk: string | null): string | null {
  const seen = new Set<string>()

  const addDigits = (raw: string) => {
    const d = raw.replace(/\D/g, '')
    if (d.length >= 8) seen.add(d)
  }

  if (noSong) addDigits(noSong)
  if (dcRmk) dcRmk.split('/').forEach(addDigits)

  if (seen.size === 0) return null
  return Array.from(seen).join('\n')
}

/**
 * 주문번호(NO_PO_PARTNER)로 ERP 송장번호 조회
 * 1순위: CZ_PU_INOUT_CONF_PROC (NO_SONG + DC_RMK)
 * 2순위: CZ_SA_ORDER.NO_SONG
 */
export async function getErpTrackingNumber(orderNumber: string): Promise<string | null> {
  try {
    const pool = await getErpPool()

    // 1순위: SA_SOH → SA_GIRL → CZ_PU_INOUT_CONF_PROC (NO_GIR = NO_RCV 직접 연결)
    const r1 = await pool.request()
      .input('orderNumber', sql.VarChar(100), orderNumber)
      .query(`
        SELECT DISTINCT
          NULLIF(LTRIM(RTRIM(P.NO_SONG)), '') AS no_song,
          NULLIF(LTRIM(RTRIM(P.DC_RMK)),  '') AS dc_rmk
        FROM NEOE.SA_SOH SOH
        JOIN NEOE.SA_GIRL GIRL
          ON SOH.NO_SO = GIRL.NO_SO AND SOH.CD_COMPANY = GIRL.CD_COMPANY
        JOIN NEOE.CZ_PU_INOUT_CONF_PROC P
          ON GIRL.NO_GIR = P.NO_RCV AND GIRL.CD_COMPANY = P.CD_COMPANY
        WHERE SOH.CD_COMPANY = '1000'
          AND SOH.NO_HST = 0
          AND SOH.NO_PO_PARTNER = @orderNumber
          AND (NULLIF(LTRIM(RTRIM(P.NO_SONG)), '') IS NOT NULL
            OR NULLIF(LTRIM(RTRIM(P.DC_RMK)),  '') IS NOT NULL)
      `)

    if (r1.recordset.length > 0) {
      const combined = r1.recordset
        .map(row => extractTrackingNumbers(row.no_song, row.dc_rmk))
        .filter(Boolean)
        .join('\n')
      const unique = Array.from(new Set(combined.split('\n').filter(Boolean)))
      if (unique.length > 0) return unique.join('\n')
    }

    // 2순위: CZ_SA_ORDER.NO_SONG
    const r2 = await pool.request()
      .input('orderNumber', sql.VarChar(100), orderNumber)
      .query(`
        SELECT TOP 1 NULLIF(LTRIM(RTRIM(CZ.NO_SONG)), '') AS tracking_no
        FROM NEOE.SA_SOH SOH
        JOIN NEOE.SA_SOL SOL
          ON SOH.NO_SO = SOL.NO_SO AND SOH.CD_COMPANY = SOL.CD_COMPANY AND SOL.NO_HST = 0
        LEFT JOIN NEOE.CZ_SA_ORDER CZ
          ON SOL.NO_SO = CZ.NO_ORDER AND SOL.SEQ_SO = CZ.SEQ_ORDER AND SOL.CD_COMPANY = CZ.CD_COMPANY
        WHERE SOH.CD_COMPANY = '1000'
          AND SOH.NO_HST = 0
          AND SOH.NO_PO_PARTNER = @orderNumber
          AND NULLIF(LTRIM(RTRIM(CZ.NO_SONG)), '') IS NOT NULL
      `)

    return r2.recordset[0]?.tracking_no ?? null
  } catch {
    return null
  }
}

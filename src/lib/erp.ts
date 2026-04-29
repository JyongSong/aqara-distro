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
 * 주문번호(NO_PO_PARTNER)로 ERP 송장번호 조회
 * NO_PO_PARTNER = aqara-distro order_number 규칙을 따를 때 동작
 */
export async function getErpTrackingNumber(orderNumber: string): Promise<string | null> {
  try {
    const pool = await getErpPool()
    const result = await pool.request()
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
    return result.recordset[0]?.tracking_no ?? null
  } catch {
    return null
  }
}

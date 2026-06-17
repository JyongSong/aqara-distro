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

    // 1. Get NO_SO and CD_COMPANY from SA_SOL (partner order number is stored in NO_ORDER_ON)
    const solResult = await pool.request()
      .input('orderNumber', sql.VarChar(100), orderNumber)
      .query(`
        SELECT DISTINCT NO_SO, CD_COMPANY
        FROM NEOE.SA_SOL
        WHERE CD_COMPANY = '1000'
          AND NO_HST = 0
          AND NO_ORDER_ON = @orderNumber
      `)

    if (solResult.recordset.length === 0) {
      console.log(`[erp] No matching SA_SOL record found for NO_ORDER_ON = ${orderNumber}`)
      return null
    }

    const allTrackingNumbers = new Set<string>()

    for (const sol of solResult.recordset) {
      const noSo = sol.NO_SO as string | undefined
      const cdCompany = sol.CD_COMPANY as string | undefined
      if (!noSo || !cdCompany) continue

      // Priority 1: CZ_PU_INOUT_CONF_PROC via SA_GIRL
      const girlResult = await pool.request()
        .input('noSo', sql.VarChar(100), noSo)
        .input('cdCompany', sql.VarChar(7), cdCompany)
        .query(`
          SELECT DISTINCT NO_GIR
          FROM NEOE.SA_GIRL
          WHERE CD_COMPANY = @cdCompany
            AND NO_SO = @noSo
        `)

      if (girlResult.recordset.length > 0) {
        const noGirList = girlResult.recordset.map(r => r.NO_GIR).filter(Boolean) as string[]
        
        if (noGirList.length > 0) {
          const request = pool.request()
          request.input('cdCompany', sql.VarChar(7), cdCompany)
          
          const paramNames = noGirList.map((_, i) => `gir_${i}`)
          paramNames.forEach((name, i) => {
            request.input(name, sql.VarChar(100), noGirList[i])
          })

          const queryStr = `
            SELECT DISTINCT
              NULLIF(LTRIM(RTRIM(P.NO_SONG)), '') AS no_song,
              NULLIF(LTRIM(RTRIM(P.DC_RMK)),  '') AS dc_rmk
            FROM NEOE.CZ_PU_INOUT_CONF_PROC P
            WHERE P.CD_COMPANY = @cdCompany
              AND P.NO_RCV IN (${paramNames.map(p => `@${p}`).join(', ')})
              AND (NULLIF(LTRIM(RTRIM(P.NO_SONG)), '') IS NOT NULL
                OR NULLIF(LTRIM(RTRIM(P.DC_RMK)),  '') IS NOT NULL)
          `
          
          const procResult = await request.query(queryStr)
          
          if (procResult.recordset.length > 0) {
            procResult.recordset.forEach(row => {
              const extracted = extractTrackingNumbers(row.no_song, row.dc_rmk)
              if (extracted) {
                extracted.split('\n').forEach(num => {
                  if (num) allTrackingNumbers.add(num)
                })
              }
            })
          }
        }
      }

      // If we found tracking numbers via Priority 1, we don't need to check Priority 2 for this order
      if (allTrackingNumbers.size > 0) {
        continue
      }

      // Priority 2: CZ_SA_ORDER.NO_SONG
      const r2 = await pool.request()
        .input('noSo', sql.VarChar(100), noSo)
        .input('cdCompany', sql.VarChar(7), cdCompany)
        .query(`
          SELECT DISTINCT NULLIF(LTRIM(RTRIM(CZ.NO_SONG)), '') AS tracking_no
          FROM NEOE.CZ_SA_ORDER CZ
          WHERE CZ.CD_COMPANY = @cdCompany
            AND CZ.NO_ORDER = @noSo
            AND NULLIF(LTRIM(RTRIM(CZ.NO_SONG)), '') IS NOT NULL
        `)

      if (r2.recordset.length > 0) {
        r2.recordset.forEach(row => {
          if (row.tracking_no) {
            row.tracking_no.split('\n').forEach((num: string) => {
              const cleaned = num.replace(/\D/g, '')
              if (cleaned.length >= 8) {
                allTrackingNumbers.add(cleaned)
              }
            })
          }
        })
      }
    }

    if (allTrackingNumbers.size > 0) {
      return Array.from(allTrackingNumbers).join('\n')
    }

    return null
  } catch (error) {
    console.error(`[erp] Error fetching tracking number for ${orderNumber}:`, error)
    return null
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'

export type BoxType = 'K100' | 'L100'
export type BoxIds = Partial<Record<BoxType, string[]>>

const BOX_TYPES: readonly BoxType[] = ['K100', 'L100']
const DEFAULT_ACTIVE_ITEMS: BoxType[] = ['K100', 'L100']

/** 설정 > 일련번호 기록 대상 품목 (system_settings.logistics_sn_items) */
export async function getActiveBoxTypes(supabase: SupabaseClient): Promise<BoxType[]> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'logistics_sn_items')
    .single()
  const value = (data?.value as string[] | undefined) ?? DEFAULT_ACTIVE_ITEMS
  return BOX_TYPES.filter(t => value.includes(t))
}

/** 주문에 포함되어 있고 설정에서 활성화된 품목 = 박스 ID 등록이 필요한 품목 */
export function getRequiredBoxTypes(activeTypes: readonly BoxType[], productCodes: readonly string[]): BoxType[] {
  return activeTypes.filter(t => productCodes.some(code => new RegExp(t, 'i').test(code)))
}

/** 필요한 품목마다 박스 ID가 1개 이상 등록되어 있는지 */
export function hasRequiredBoxIds(boxIds: BoxIds | null | undefined, required: readonly BoxType[]): boolean {
  return required.every(t => (boxIds?.[t]?.length ?? 0) > 0)
}

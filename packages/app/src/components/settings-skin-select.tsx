import { createMemo } from "solid-js"
import { Select } from "@opencode-ai/ui/select"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { useSkin } from "@/context/skin"
import type { Locale } from "@/context/language"

const copy = {
  en: ["Skin", "Apply decorative desktop chrome and panel effects."],
  zh: ["皮肤", "应用桌面装饰、窗口栏和面板效果。"],
  zht: ["皮膚", "套用桌面裝飾、視窗列與面板效果。"],
  ko: ["스킨", "데스크톱 장식과 패널 효과를 적용합니다."],
  de: ["Oberfläche", "Dekorative Desktop- und Panel-Effekte anwenden."],
  es: ["Apariencia", "Aplica decoración de escritorio y efectos de panel."],
  fr: ["Habillage", "Appliquez des décorations de bureau et des effets de panneau."],
  da: ["Udseende", "Anvend dekorative skrivebords- og paneleffekter."],
  ja: ["スキン", "デスクトップ装飾やパネル効果を適用します。"],
  pl: ["Skórka", "Zastosuj dekoracje pulpitu i efekty paneli."],
  ru: ["Оболочка", "Применяйте декоративное оформление и эффекты панелей."],
  uk: ["Оболонка", "Застосовуйте декоративне оформлення й ефекти панелей."],
  ar: ["المظهر الزخرفي", "طبّق زخارف سطح المكتب وتأثيرات اللوحات."],
  no: ["Utseende", "Bruk dekorative skrivebords- og paneleffekter."],
  br: ["Aparência", "Aplique decoração da área de trabalho e efeitos de painel."],
  th: ["สกิน", "ใช้การตกแต่งเดสก์ท็อปและเอฟเฟกต์แผง"],
  bs: ["Izgled", "Primijeni dekoraciju radne površine i efekte panela."],
  tr: ["Kaplama", "Masaüstü süslemelerini ve panel efektlerini uygulayın."],
} satisfies Record<Locale, readonly [title: string, description: string]>

export function skinSettingsText(locale: Locale) {
  return { title: copy[locale][0], description: copy[locale][1] }
}

export function SettingsSkinSelect(props: { variant: "legacy" | "v2" }) {
  const skin = useSkin()
  const options = createMemo(() => skin.skins().map((item) => ({ id: item.id, name: item.name })))

  if (props.variant === "legacy") {
    return (
      <Select
        data-action="settings-skin"
        options={options()}
        current={options().find((option) => option.id === skin.id())}
        value={(option) => option.id}
        label={(option) => option.name}
        onSelect={(option) => option && skin.set(option.id)}
        variant="secondary"
        size="small"
        triggerVariant="settings"
      />
    )
  }

  return (
    <SelectV2
      appearance="inline"
      data-action="settings-skin"
      options={options()}
      current={options().find((option) => option.id === skin.id())}
      placement="bottom-end"
      gutter={6}
      value={(option) => option.id}
      label={(option) => option.name}
      onSelect={(option) => option && skin.set(option.id)}
    />
  )
}

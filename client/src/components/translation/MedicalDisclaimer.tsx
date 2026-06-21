import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";

const LOCALIZED_DISCLAIMERS: Record<string, string> = {
  en: "Informational only. Not medical advice. Confirm with your clinician.",
  es: "Solo informativo. No es consejo médico. Confirme con su médico.",
  "zh-CN": "仅供参考。非医疗建议。请与您的医生确认。",
  vi: "Chỉ mang tính thông tin. Không phải lời khuyên y tế. Xác nhận với bác sĩ của bạn.",
  ar: "معلومات فقط. ليست نصيحة طبية. تأكد من طبيبك.",
  fr: "À titre informatif seulement. Pas un avis médical. Confirmez avec votre clinicien.",
  hi: "केवल सूचनात्मक। चिकित्सा सलाह नहीं। अपने चिकित्सक से पुष्टि करें।",
  ko: "정보 제공용입니다. 의료 조언이 아닙니다. 담당 의사와 확인하세요.",
  pt: "Apenas informativo. Não é aconselhamento médico. Confirme com seu médico.",
  ru: "Только для информации. Не является медицинской консультацией. Подтвердите у врача.",
  tl: "Impormasyon lamang. Hindi medikal na payo. Kumpirmahin sa iyong doktor.",
};

const VERIFY_WITH_CLINICIAN: Record<string, string> = {
  en: "Verify with your clinician",
  es: "Verifique con su médico",
  "zh-CN": "请与您的医生核实",
  vi: "Xác minh với bác sĩ của bạn",
  ar: "تحقق من طبيبك",
  fr: "Vérifiez avec votre clinicien",
  hi: "अपने चिकित्सक से सत्यापित करें",
  ko: "담당 의사와 확인하세요",
  pt: "Verifique com seu médico",
  ru: "Подтвердите у врача",
  tl: "Kumpirmahin sa iyong doktor",
};

interface MedicalDisclaimerProps {
  languageCode?: string;
  variant?: "default" | "warning" | "footer";
  showIcon?: boolean;
}

export function MedicalDisclaimer({ 
  languageCode = "en", 
  variant = "default",
  showIcon = true 
}: MedicalDisclaimerProps) {
  const disclaimer = LOCALIZED_DISCLAIMERS[languageCode] || LOCALIZED_DISCLAIMERS.en;

  if (variant === "footer") {
    return (
      <div 
        className="text-xs text-muted-foreground text-center py-2 border-t"
        data-testid="text-medical-disclaimer-footer"
      >
        {showIcon && <Info className="inline h-3 w-3 mr-1" />}
        {disclaimer}
      </div>
    );
  }

  if (variant === "warning") {
    return (
      <Alert variant="destructive" data-testid="alert-medical-disclaimer-warning">
        {showIcon && <AlertTriangle className="h-4 w-4" />}
        <AlertDescription>{disclaimer}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert data-testid="alert-medical-disclaimer">
      {showIcon && <Info className="h-4 w-4" />}
      <AlertDescription className="text-muted-foreground">
        {disclaimer}
      </AlertDescription>
    </Alert>
  );
}

interface VerifyWithClinicianBannerProps {
  languageCode?: string;
}

export function VerifyWithClinicianBanner({ languageCode = "en" }: VerifyWithClinicianBannerProps) {
  const text = VERIFY_WITH_CLINICIAN[languageCode] || VERIFY_WITH_CLINICIAN.en;

  return (
    <Alert variant="destructive" className="border-2" data-testid="alert-verify-clinician">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="font-semibold">
        {text}
      </AlertDescription>
    </Alert>
  );
}

export function getLocalizedDisclaimer(languageCode: string): string {
  return LOCALIZED_DISCLAIMERS[languageCode] || LOCALIZED_DISCLAIMERS.en;
}

export function getVerifyText(languageCode: string): string {
  return VERIFY_WITH_CLINICIAN[languageCode] || VERIFY_WITH_CLINICIAN.en;
}

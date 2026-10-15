import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/components/language-provider"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const VARIANT_ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
} as const

export function Toaster() {
  const { toasts } = useToast()
  const { t } = useLanguage()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const Icon =
          props.variant && props.variant !== "default"
            ? VARIANT_ICONS[props.variant]
            : null
        return (
          <Toast key={id} {...props}>
            <div className="flex items-start gap-3">
              {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose aria-label={t("common.close")} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

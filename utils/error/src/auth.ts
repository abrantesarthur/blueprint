/** Error messages produced by the auth module. */
export const AuthErrorMessage = {
  /** Refresh token is invalid or expired. */
  INVALID_REFRESH_TOKEN: "Invalid refresh token",
  /** User referenced by the token no longer exists. */
  USER_NOT_FOUND: "User not found",
  /** No active OTP exists for the given phone number. */
  EXPIRED_OTP: "No valid OTP found. Please request a new code.",
  /** Maximum OTP verification attempts reached. */
  MAX_OTP_ATTEMPTS:
    "Maximum verification attempts exceeded. Please request a new code.",
  /** OTP request token does not match the stored hash. */
  INVALID_REQUEST_TOKEN: "Invalid request token.",
  /** OTP code does not match the stored hash. */
  INVALID_OTP: "Invalid verification code.",
  /** No OTP delivery provider is configured for this environment. */
  OTP_DELIVERY_NOT_CONFIGURED:
    "OTP delivery is not configured — plug in your provider (email/SMS).",
} as const;

/** Union of all auth error message strings. */
export type AuthErrorMessage =
  (typeof AuthErrorMessage)[keyof typeof AuthErrorMessage];

/** Portuguese translations for auth error messages. */
export const AuthErrorTranslation: Record<AuthErrorMessage, string> = {
  [AuthErrorMessage.INVALID_REFRESH_TOKEN]:
    "Sessão expirada. Faça login novamente.",
  [AuthErrorMessage.USER_NOT_FOUND]: "Usuário não encontrado.",
  [AuthErrorMessage.EXPIRED_OTP]: "Código expirado. Solicite um novo código.",
  [AuthErrorMessage.MAX_OTP_ATTEMPTS]:
    "Tentativas de verificação excedidas. Solicite um novo código.",
  [AuthErrorMessage.INVALID_REQUEST_TOKEN]:
    "Solicitação inválida. Tente novamente.",
  [AuthErrorMessage.INVALID_OTP]: "Código inválido",
  [AuthErrorMessage.OTP_DELIVERY_NOT_CONFIGURED]:
    "O envio de códigos de verificação não está configurado.",
};

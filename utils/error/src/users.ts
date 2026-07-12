/** Error messages produced by the users module. */
export const UserErrorMessage = {
  /** Registration token is invalid or has expired. */
  EXPIRED_REGISTRATION: "Invalid or expired registration token",
  /** A user with the given phone number already exists. */
  PHONE_ALREADY_EXISTS: "A user with this phone number already exists",
  /** User record could not be found for update. */
  USER_NOT_FOUND: "Could not find the user to update!",
  /** Caller is not authorized to view the requested user. */
  ACCESS_DENIED: "Access denied",
} as const;

/** Union of all user error message strings. */
export type UserErrorMessage =
  (typeof UserErrorMessage)[keyof typeof UserErrorMessage];

/** Portuguese translations for user error messages. */
export const UserErrorTranslation: Record<UserErrorMessage, string> = {
  [UserErrorMessage.EXPIRED_REGISTRATION]:
    "Sua sessão expirou. Por favor, tente novamente.",
  [UserErrorMessage.PHONE_ALREADY_EXISTS]:
    "Já existe um usuário com este número de telefone.",
  [UserErrorMessage.USER_NOT_FOUND]: "Não foi possível encontrar o usuário.",
  [UserErrorMessage.ACCESS_DENIED]: "Acesso negado.",
};

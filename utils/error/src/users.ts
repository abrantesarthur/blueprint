/** Error messages produced by the users module. */
export const UserErrorMessage = {
  /** A user with the given email address already exists. */
  EMAIL_ALREADY_EXISTS: "A user with this email address already exists",
  /** User record could not be found. */
  USER_NOT_FOUND: "Could not find the user!",
  /** Caller is not authorized to view the requested user. */
  ACCESS_DENIED: "Access denied",
} as const;

/** Union of all user error message strings. */
export type UserErrorMessage =
  (typeof UserErrorMessage)[keyof typeof UserErrorMessage];

/** Portuguese translations for user error messages. */
export const UserErrorTranslation: Record<UserErrorMessage, string> = {
  [UserErrorMessage.EMAIL_ALREADY_EXISTS]:
    "Já existe um usuário com este endereço de e-mail.",
  [UserErrorMessage.USER_NOT_FOUND]: "Não foi possível encontrar o usuário.",
  [UserErrorMessage.ACCESS_DENIED]: "Acesso negado.",
};

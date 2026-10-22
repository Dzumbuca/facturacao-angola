/**
 * Validação de NIF Angolano (Formato comum: 9 dígitos + 2 check digits/letras)
 * Exemplo simples: Valida apenas o formato base.
 */
export const validateAngolanNIF = (nif: string): boolean => {
  // Nota: Implementação simplificada apenas para fins de protótipo.
  // Regra real envolve algoritmos de verificação de dígitos de controlo.
  const nifRegex = /^[0-9]{9}[A-Z]{2}[0-9]{3}$/; // Exemplo: 123456789LA000
  return nifRegex.test(nif);
};

import { PLUGINS_REGISTRADOS } from "./plugins";
import { criarRegistro, type ActivityRegistry } from "./registry";

/**
 * O registro que a aplicação usa.
 *
 * Fica separado de `registry.ts` de propósito: o núcleo continua sem conhecer o
 * manifesto, e o teste do núcleo continua podendo montar registros com plugins
 * de mentira. Aqui é só a amarração.
 *
 * Construído uma vez por processo — montar o mapa a cada requisição seria
 * desperdício, e plugins são imutáveis.
 */
export const registroPadrao: ActivityRegistry = criarRegistro(PLUGINS_REGISTRADOS);

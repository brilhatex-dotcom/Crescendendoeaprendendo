import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes e resolve conflitos do Tailwind.
 *
 * `clsx` monta a lista; `twMerge` garante que a última classe da mesma família
 * vença — sem ele, `className="px-4"` vindo de fora não sobrescreveria o `px-8`
 * do componente, porque a ordem no arquivo CSS é que decidiria.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

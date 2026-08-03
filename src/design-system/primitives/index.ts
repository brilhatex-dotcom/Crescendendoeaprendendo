/**
 * Primitivos do Design System.
 *
 * Regra da camada: recebem props, não conhecem domínio, não importam
 * `@/modules` nem `@/server` (verificado por lint e por dependency-cruiser).
 */

export { Alert, type AlertProps, type TomDoAlerta } from "./alert";
export { Button, buttonStyles, type ButtonProps } from "./button";
export { Card, type CardProps } from "./card";
export { Field, type FieldProps } from "./field";

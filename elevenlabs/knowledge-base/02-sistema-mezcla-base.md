# Sistema de mezcla: problema base

Este documento describe el caso base mas importante para Rubidium.

## Situacion

Se tiene un tanque con:

- 100 litros de agua pura al inicio
- entrada de una disolucion salina con concentracion de 0.5 kg/L
- flujo de entrada de 4 L/min
- flujo de salida de 4 L/min

Como el flujo de entrada y el flujo de salida son iguales, el volumen del tanque permanece constante.

## Variable principal

Sea Q(t) la cantidad de sal en el tanque en el tiempo t.

La concentracion dentro del tanque es:

C(t) = Q(t) / 100

## Balance del sistema

La razon de cambio de la sal dentro del tanque se obtiene con:

acumulacion = entrada - salida

### Entrada de sal

La entrada de sal es:

0.5 kg/L * 4 L/min = 2 kg/min

### Salida de sal

La concentracion de salida es la misma que la concentracion en el tanque:

Q(t) / 100 kg/L

Como la salida es de 4 L/min, la tasa de salida de sal es:

(Q(t) / 100) * 4 = Q(t) / 25

## Ecuacion diferencial

La ecuacion resultante es:

dQ/dt = 2 - Q(t)/25

## Condicion inicial

Como el tanque inicia con agua pura:

Q(0) = 0

## Solucion

La solucion del problema es:

Q(t) = 50(1 - e^(-t/25))

## Concentracion

La concentracion queda:

C(t) = Q(t) / 100 = 0.5(1 - e^(-t/25))

## Interpretacion

- Al inicio no hay sal en el tanque.
- Con el tiempo entra sal y la cantidad aumenta.
- La salida tambien arrastra sal.
- El sistema no crece sin limite.
- La cantidad de sal se acerca a 50 kg.
- La concentracion se acerca a 0.5 kg/L.

## Idea clave

Cuando el volumen es constante, el problema se entiende como un balance entre lo que entra y lo que sale.

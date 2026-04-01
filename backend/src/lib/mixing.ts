export type MixingInput = {
  initialVolumeLiters: number;
  initialSoluteKg: number;
  inflowRateLitersPerMin: number;
  outflowRateLitersPerMin: number;
  inflowConcentrationKgPerLiter: number;
};

export type MixingSolution = {
  title: string;
  prompt: string;
  normalizedText: string;
  finalAnswer: string;
  explanation: string;
  steps: Array<{
    stepNumber: number;
    title: string;
    explanation: string;
    latex?: string;
  }>;
};

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function formatSignedExponential(baseValue: number, coefficient: number, constant: number) {
  const roundedBase = round(baseValue);
  const roundedCoefficient = round(coefficient);
  const roundedConstant = round(constant);

  if (roundedConstant === 0) {
    return `Q(t) = ${roundedBase}`;
  }

  const sign = roundedConstant > 0 ? "+" : "-";
  return `Q(t) = ${roundedBase} ${sign} ${Math.abs(roundedConstant)}e^(-${roundedCoefficient}t)`;
}

function formatSignedConcentration(
  volume: number,
  equilibriumConcentration: number,
  coefficient: number,
  constant: number
) {
  const roundedVolume = round(volume);
  const roundedEquilibrium = round(equilibriumConcentration);
  const roundedCoefficient = round(coefficient);
  const roundedConstant = round(constant / volume);

  if (roundedConstant === 0) {
    return `C(t) = Q(t)/${roundedVolume} = ${roundedEquilibrium}`;
  }

  const sign = roundedConstant > 0 ? "+" : "-";
  return `C(t) = Q(t)/${roundedVolume} = ${roundedEquilibrium} ${sign} ${Math.abs(roundedConstant)}e^(-${roundedCoefficient}t)`;
}

export function solveConstantVolumeMixing(input: MixingInput): MixingSolution {
  const {
    initialVolumeLiters,
    initialSoluteKg,
    inflowRateLitersPerMin,
    outflowRateLitersPerMin,
    inflowConcentrationKgPerLiter
  } = input;

  if (initialVolumeLiters <= 0) {
    throw new Error("El volumen inicial debe ser mayor que cero.");
  }

  if (inflowRateLitersPerMin !== outflowRateLitersPerMin) {
    throw new Error("Por ahora solo se soporta volumen constante: entrada y salida deben ser iguales.");
  }

  const inputSaltRate = inflowConcentrationKgPerLiter * inflowRateLitersPerMin;
  const outflowCoefficient = outflowRateLitersPerMin / initialVolumeLiters;
  const equilibriumMass = inputSaltRate / outflowCoefficient;
  const equilibriumConcentration = equilibriumMass / initialVolumeLiters;
  const integrationConstant = initialSoluteKg - equilibriumMass;

  const simplifiedQFormula = formatSignedExponential(equilibriumMass, outflowCoefficient, integrationConstant);
  const cFormula = formatSignedConcentration(
    initialVolumeLiters,
    equilibriumConcentration,
    outflowCoefficient,
    integrationConstant
  );

  const prompt =
    `Tanque de mezcla con volumen inicial ${initialVolumeLiters} L, ` +
    `sal inicial ${initialSoluteKg} kg, flujo de entrada ${inflowRateLitersPerMin} L/min, ` +
    `flujo de salida ${outflowRateLitersPerMin} L/min y concentracion de entrada ` +
    `${inflowConcentrationKgPerLiter} kg/L.`;

  const steps = [
    {
      stepNumber: 1,
      title: "Que estamos siguiendo",
      explanation:
        `Llamamos Q(t) a la cantidad de sal que hay dentro del tanque en el instante t. ` +
        `Esto nos permite seguir una sola cantidad que cambia con el tiempo. ` +
        `Como entran y salen ${outflowRateLitersPerMin} L/min, el volumen se mantiene fijo en ${initialVolumeLiters} L.`
    },
    {
      stepNumber: 2,
      title: "Cuanta sal entra y cuanta sale",
      explanation:
        `Primero miramos la entrada. Cada minuto entran ${inflowRateLitersPerMin} litros y cada litro trae ` +
        `${inflowConcentrationKgPerLiter} kg de sal, asi que entran ${round(inputSaltRate)} kg/min. ` +
        `Despues miramos la salida. Dentro del tanque la concentracion es Q(t)/${initialVolumeLiters}, ` +
        `por eso al salir ${outflowRateLitersPerMin} L/min se van ${round(outflowCoefficient)}Q(t) kg/min.`,
      latex: `\\frac{dQ}{dt}= ${round(inputSaltRate)} - ${round(outflowCoefficient)}Q(t)`
    },
    {
      stepNumber: 3,
      title: "Balance del tanque",
      explanation:
        `La idea clave es sencilla: el cambio de sal dentro del tanque es "lo que entra menos lo que sale". ` +
        `Por eso la ecuacion queda dQ/dt + ${round(outflowCoefficient)}Q = ${round(inputSaltRate)}.`
    },
    {
      stepNumber: 4,
      title: "Forma de la solucion",
      explanation:
        `Al resolver la ecuacion aparece una parte fija y otra parte que se va apagando con el tiempo. ` +
        `Esa estructura se escribe como Q(t) = ${round(equilibriumMass)} + Ce^(-${round(outflowCoefficient)}t). ` +
        `La constante C todavia no esta definida porque depende del dato inicial.`
    },
    {
      stepNumber: 5,
      title: "Usamos el dato inicial",
      explanation:
        `Al inicio hay ${initialSoluteKg} kg de sal, asi que sustituimos Q(0) = ${initialSoluteKg}. ` +
        `Con eso obtenemos C = ${round(integrationConstant)} y la expresion final queda ${simplifiedQFormula}.`
    },
    {
      stepNumber: 6,
      title: "Concentracion dentro del tanque",
      explanation:
        `La concentracion se obtiene dividiendo la cantidad de sal entre el volumen. ` +
        `Como el volumen es ${initialVolumeLiters} L, resulta ${cFormula}.`
    },
    {
      stepNumber: 7,
      title: "Que significa el resultado",
      explanation:
        `La parte exponencial se hace cada vez mas pequena a medida que pasa el tiempo. ` +
        `Eso significa que el sistema se estabiliza: Q(t) se acerca a ${round(equilibriumMass)} kg ` +
        `y la concentracion se acerca a ${round(equilibriumConcentration)} kg/L. ` +
        `En palabras simples, despues de suficiente tiempo la mezcla deja de cambiar de forma importante.`
    }
  ];

  return {
    title: "Sistema de mezcla con volumen constante",
    prompt,
    normalizedText: JSON.stringify(input),
    finalAnswer: `${simplifiedQFormula}; ${cFormula}`,
    explanation:
      `La idea central es seguir la sal que entra y la sal que sale del tanque. ` +
      `El modelo muestra que la mezcla cambia rapido al principio, pero poco a poco se estabiliza ` +
      `hasta acercarse a ${round(equilibriumMass)} kg de sal y a una concentracion de ${round(
        equilibriumConcentration
      )} kg/L.`,
    steps
  };
}

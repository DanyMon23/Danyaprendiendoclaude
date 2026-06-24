/**
 * Calcula el factorial de un número entero no negativo.
 * @param {number} n
 * @returns {number}
 */
function factorial(n) {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new TypeError(`Se esperaba un entero, se recibió: ${typeof n}`);
  }
  if (n < 0) {
    throw new RangeError(`El factorial no está definido para números negativos: ${n}`);
  }
  if (n > 170) {
    throw new RangeError(`El número ${n} excede el límite seguro (170) y produciría Infinity`);
  }

  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

module.exports = { factorial };

const input = process.argv[2];

if (input === undefined) {
  console.error("Uso: node src/api.js <número>");
  process.exit(1);
}

const n = Number(input);

try {
  console.log(`factorial(${n}) = ${factorial(n)}`);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

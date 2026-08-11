// Arnes minimo de pruebas. Sin dependencias: se ejecuta con `node`.
//
// Las comprobaciones afirman la propiedad que importa y no un numero que hay que
// interpretar. "45 columnas creadas" no dice nada si nadie sabe cuantas
// corresponden; "ninguna columna se repite" si.

let pruebas = [];

function prueba(nombre, funcion) {
  pruebas.push({ nombre, funcion });
}

function afirmar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje || 'La condicion resulto falsa.');
}

function igual(obtenido, esperado, mensaje) {
  if (obtenido !== esperado) {
    throw new Error((mensaje ? mensaje + '. ' : '') + 'Se esperaba ' + JSON.stringify(esperado) + ' y se obtuvo ' + JSON.stringify(obtenido) + '.');
  }
}

function cercano(obtenido, esperado, tolerancia, mensaje) {
  const t = tolerancia === undefined ? 0.0001 : tolerancia;
  if (obtenido === null || Math.abs(obtenido - esperado) > t) {
    throw new Error((mensaje ? mensaje + '. ' : '') + 'Se esperaba aproximadamente ' + esperado + ' y se obtuvo ' + obtenido + '.');
  }
}

function esNulo(valor, mensaje) {
  if (valor !== null) {
    throw new Error((mensaje ? mensaje + '. ' : '') + 'Se esperaba null y se obtuvo ' + JSON.stringify(valor) + '.');
  }
}

function ejecutar(titulo) {
  console.log('\n' + titulo);
  console.log('='.repeat(titulo.length));

  let fallas = 0;
  pruebas.forEach(({ nombre, funcion }) => {
    try {
      funcion();
      console.log('  ok   ' + nombre);
    } catch (error) {
      fallas += 1;
      console.log('  FALLA ' + nombre);
      console.log('        ' + error.message);
    }
  });

  const total = pruebas.length;
  console.log('\n' + (total - fallas) + ' de ' + total + ' comprobaciones pasaron.');
  pruebas = [];
  return fallas;
}

module.exports = { prueba, afirmar, igual, cercano, esNulo, ejecutar };

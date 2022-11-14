const { query } = require("express-validator");

async function insertPayment(
  payment_amount,
  payment_date,
  credit_id,
  client_id,
  cash_flow_list,
  gran_total,
  USER_ID,
  account_id,
  caja_id
) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const promises = [];
  const payed_ci = [];
  var payed_capital = Number(0);
  var payed_intereses = Number(0);
  var payed_punitorios = Number(0);
  var payed_seguro = Number(0);
  let hasRows = 0;

  if (cash_flow_list && cash_flow_list.length > 0) {
    payment_amount = gran_total;
  }

  const sql = `INSERT INTO payments ( clientID,paymentDate,amount,credit_id,account_id,responsable) VALUES (?,?,?,?,?,?)`;
  try {
    const insertedPayment = await query(sql, [
      client_id,
      payment_date,
      payment_amount,
      credit_id,
      account_id,
      USER_ID
    ]);
    const insertId = insertedPayment.insertId;

    const insertLog = `INSERT INTO record_logs (type,userId,createdAt,affectedId,credit_id) VALUES ('insert-payment',?,NOW(),?,?)`;
    await query(insertLog, [USER_ID, insertId, credit_id]);

    if (cash_flow_list && cash_flow_list.length > 0) {
      const updateCashFlowItems = `UPDATE cash_flow SET used_in_payments = 1 WHERE id IN(${cash_flow_list.join(
        ","
      )})`;
      await query(updateCashFlowItems, []);
    }

    const creditsItemsQuery = `SELECT CASE WHEN p.amount IS NOT NULL THEN SUM(p.amount) ELSE 0 END punitorios, ci.capital,ci.otorgamiento,ci.intereses, ci.amount , ci.period, ci.safe, ci.payed , ci.id
                                    FROM punitorios p
                                    RIGHT JOIN credits_items ci ON ci.credit_id = p.credit_id
                                    	AND MONTH(p.period) = MONTH(ci.period)
                                    	AND YEAR (p.period) = YEAR(ci.period)
                                    where ci.credit_id = ?
                                    GROUP by ci.period order by ci.period`;
    const creditsItems = await query(creditsItemsQuery, [credit_id]);
    let disponible = Number(payment_amount);
    for (let index = 0; index < creditsItems.length; index++) {
      let row = creditsItems[index];

      let capital = Number(row.capital);
      let intereses = Number(row.intereses);
      let cuota_total = Number(row.amount);
      let safe = Number(row.safe);
      let period = row.period;
      let punitorios = Number(row.punitorios);
      let deuda_total = (
        Number(cuota_total) +
        Number(safe) +
        Number(punitorios)
      ).toFixed(2);
      let payed = Number(row.payed);
      let credit_item_id = row.id;
      hasRows = 1;
      let saldoapagar = (Number(deuda_total) - Number(payed)).toFixed(2);
      let newpayed = 0;

      // chequeamos para cada item del credito el estado

      const obtenerIngresosPorTipo = await query(
        `SELECT SUM(amount) ingresado, operation_type, credit_item_id FROM cash_flow WHERE credit_item_id = ? AND deleted_at IS NULL GROUP BY operation_type`,
        [credit_item_id]
      );
      // console.log("Ingreso", obtenerIngresosPorTipo);

      let obtenerIngresosPorTipoArray = {
        ingreso_seguro_cuotas: 0,
        ingreso_punitorios_cuotas: 0,
        ingreso_interes_cuotas: 0,
        ingreso_capital_cuotas: 0,
        ingreso_nota_debito: 0
      };

      if (obtenerIngresosPorTipo && obtenerIngresosPorTipo.length > 0) {
        obtenerIngresosPorTipo.forEach((ingreso) => {
          obtenerIngresosPorTipoArray[ingreso.operation_type] =
            ingreso.ingresado;
        });
      }

      /* -------------------------------------------------------------------------- */
      /*                          Nota de credito y debito                          */
      /* -------------------------------------------------------------------------- */
      const totalNotaDebitoCredito = {
        ingreso_nota_credito: 0,
        egreso_nota_debito: 0,
      }
      const obtenerNCreditoNDebito = await query('SELECT sum(p.amount) totalAmount,p.*, c.name FROM cayetano.payments p inner join  cayetano.cash_flow_accounts c on p.account_id = c.id where payed_ci = ? and name in ("Nota de Crédito","Nota de Débito","Nota de Credito","Nota de Debito") group by name;', [credit_item_id.toString()])
      obtenerNCreditoNDebito.map(item => {
        if (item.name === "Nota de Crédito" || item.name === "Nota de Credito") {
          totalNotaDebitoCredito.ingreso_nota_credito = item.totalAmount
        } else {
          totalNotaDebitoCredito.egreso_nota_debito = Math.abs(item.totalAmount)
        }
      })


      // Nota de credito - sumar a cuotas item
      //punitorios
      if (obtenerIngresosPorTipoArray.ingreso_punitorios_cuotas < punitorios && totalNotaDebitoCredito.ingreso_nota_credito > 0) {
        const restantePunitorios = punitorios - obtenerIngresosPorTipoArray.ingreso_punitorios_cuotas

        if (totalNotaDebitoCredito.ingreso_nota_credito < restantePunitorios) {
          obtenerIngresosPorTipoArray.ingreso_punitorios_cuotas += totalNotaDebitoCredito.ingreso_nota_credito
          totalNotaDebitoCredito.ingreso_nota_credito = 0
        } else if (totalNotaDebitoCredito.ingreso_nota_credito >= restantePunitorios) {
          obtenerIngresosPorTipoArray.ingreso_punitorios_cuotas += restantePunitorios
          totalNotaDebitoCredito.ingreso_nota_credito -= restantePunitorios
        }
      }
      //Interes
      if (obtenerIngresosPorTipoArray.ingreso_interes_cuotas < intereses && totalNotaDebitoCredito.ingreso_nota_credito > 0) {
        const restanteInteres = intereses - obtenerIngresosPorTipoArray.ingreso_interes_cuotas

        if (totalNotaDebitoCredito.ingreso_nota_credito < restanteInteres) {
          obtenerIngresosPorTipoArray.ingreso_interes_cuotas += totalNotaDebitoCredito.ingreso_nota_credito
          totalNotaDebitoCredito.ingreso_nota_credito = 0
        } else if (totalNotaDebitoCredito.ingreso_nota_credito >= restanteInteres) {
          obtenerIngresosPorTipoArray.ingreso_interes_cuotas += restanteInteres
          totalNotaDebitoCredito.ingreso_nota_credito -= restanteInteres
        }
      }
      //Seguro
      if (obtenerIngresosPorTipoArray.ingreso_seguro_cuotas < safe && totalNotaDebitoCredito.ingreso_nota_credito > 0) {
        const restanteSeguro = safe - obtenerIngresosPorTipoArray.ingreso_seguro_cuotas

        if (totalNotaDebitoCredito.ingreso_nota_credito < restanteSeguro) {
          obtenerIngresosPorTipoArray.ingreso_seguro_cuotas += totalNotaDebitoCredito.ingreso_nota_credito
          totalNotaDebitoCredito.ingreso_nota_credito = 0
        } else if (totalNotaDebitoCredito.ingreso_nota_credito >= restanteSeguro) {
          obtenerIngresosPorTipoArray.ingreso_seguro_cuotas += restanteSeguro
          totalNotaDebitoCredito.ingreso_nota_credito -= restanteSeguro
        }
      }
      //Capital
      if (obtenerIngresosPorTipoArray.ingreso_capital_cuotas < capital && totalNotaDebitoCredito.ingreso_nota_credito > 0) {
        const restanteCapital = capital - obtenerIngresosPorTipoArray.ingreso_capital_cuotas

        if (totalNotaDebitoCredito.ingreso_nota_credito < restanteCapital) {
          obtenerIngresosPorTipoArray.ingreso_capital_cuotas += totalNotaDebitoCredito.ingreso_nota_credito
          totalNotaDebitoCredito.ingreso_nota_credito = 0
        } else if (totalNotaDebitoCredito.ingreso_nota_credito >= restanteCapital) {
          obtenerIngresosPorTipoArray.ingreso_capital_cuotas += restanteCapital
          totalNotaDebitoCredito.ingreso_nota_credito -= restanteCapital
        }
      }
      //Debito
      if (obtenerIngresosPorTipoArray.ingreso_nota_debito < totalNotaDebitoCredito.egreso_nota_debito && totalNotaDebitoCredito.ingreso_nota_credito > 0) {
        const restanteDebito = totalNotaDebitoCredito.egreso_nota_debito - obtenerIngresosPorTipoArray.ingreso_nota_debito

        if (totalNotaDebitoCredito.ingreso_nota_credito < restanteDebito) {
          obtenerIngresosPorTipoArray.ingreso_nota_debito += totalNotaDebitoCredito.ingreso_nota_credito
          totalNotaDebitoCredito.ingreso_nota_credito = 0
        } else if (totalNotaDebitoCredito.ingreso_nota_credito >= restanteDebito) {
          obtenerIngresosPorTipoArray.ingreso_nota_debito += restanteDebito
          totalNotaDebitoCredito.ingreso_nota_credito -= restanteDebito
        }
      }

      console.log("totalNotaDebitoCredito", totalNotaDebitoCredito);

      /*
      Suponiendo que la deuda total es de 20.000 para este cuota (cuota $10.000, seguro $5000 y punitorios $5000) y el orden de cancelacion de los elementos es en este orden:
      
      punitorios/interes/seguro/capital

       ---------------------------------- EN EL CASO DE QUE LA SUMA DE PUNITORIOS PARA ESTE PERIODO
      */
      if (
        obtenerIngresosPorTipoArray["ingreso_punitorios_cuotas"] < punitorios &&
        punitorios > 0
      ) {
        punitorios =
          punitorios - obtenerIngresosPorTipoArray["ingreso_punitorios_cuotas"];

        let processed = 0;

        // - Es igual al disponible inserta en cashflow, coloca el disponible en 0 y finaliza la operacion
        if (punitorios == disponible && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de punitorios de cuota',?,?,'ingreso_punitorios_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            punitorios,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +punitorios;
          disponible = 0;
        }

        // - Es menor al disponible inserta en cashflow, coloca el disponible en disponible - punitorios y sigue con la otra evaluacion de la operacion
        if (punitorios < disponible && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de punitorios de cuota',?,?,'ingreso_punitorios_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            punitorios,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +punitorios;
          disponible = disponible - punitorios;
          processed = 1;
        }

        // - Es mayor al disponible inserta en cashflow el disponible, coloca en 0 el disponible y termina la operacion
        if (punitorios > disponible && processed == 0 && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de punitorios de cuota',?,?,'ingreso_punitorios_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            disponible,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +disponible;
          disponible = 0;
        }
      }

      // console.log("disponible antes de intereses", disponible);

      /*SI LLEGO ACA ES PORQUE QUEDA DISPONIBLE Y EVALUAMOS intereses

      ---------------------------------- EN EL CASO DE QUE EL INTERES
      */

      if (
        obtenerIngresosPorTipoArray["ingreso_interes_cuotas"] < intereses &&
        intereses > 0
      ) {
        let processed = 0;
        intereses = intereses - obtenerIngresosPorTipoArray["ingreso_interes_cuotas"];

        // - Es igual al disponible inserta en cashflow, coloca el disponible en 0 y finaliza la operacion
        if (intereses == disponible && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de interes de cuota',?,?,'ingreso_interes_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            intereses,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +intereses;
          disponible = 0;
        }

        // - Es menor al disponible inserta en cashflow, coloca el disponible en disponible - interes y sigue con la otra evaluacion de la operacion
        if (intereses < disponible && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de interes de cuota',?,?,'ingreso_interes_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            intereses,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +intereses;
          disponible = disponible - intereses;
          processed = 1;
        }

        // - Es mayor al disponible inserta en cashflow el interes, coloca en 0 el disponible y termina la operacion
        if (intereses > disponible && processed == 0 && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de interes de cuota',?,?,'ingreso_interes_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            disponible,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +disponible;
          disponible = 0;
        }
      }

      // console.log("disponible antes de capital", disponible);

      /*

      ----------------------------------EN EL CASO DE QUE EL SEGURO    
      */

      //verificamos que no se haya cargado ya un seguro para este credit_item y que el valor de los pagos no sea menor a el valor del seguro
      if (
        obtenerIngresosPorTipoArray["ingreso_seguro_cuotas"] < safe &&
        safe > 0
      ) {
        // - Sea menor a el disponible cargamos el pago en cashflow, restamos el disponible y seguimos con la otra evaluacion de la operacion

        let processed = 0;

        safe = safe - obtenerIngresosPorTipoArray["ingreso_seguro_cuotas"];

        // console.log("disponible antes de seguro", disponible);

        // - Sea igual al disponible cargamos el pago en cashflow, restamos el disponible y finalizamos la operacion
        if (safe == disponible && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de seguro de cuota',?,?,'ingreso_seguro_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            safe,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          disponible = 0;
          newpayed += +safe;
        }

        if (safe < disponible && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de seguro de cuota',?,?,'ingreso_seguro_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            safe,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +safe;
          disponible = disponible - safe;
          processed = 1;
        }

        //- Sea mayor al disponible cargamos el pago en cashflow del valor del seguro, ponemos el disponible en 0 y terminamos la operacion
        if (safe > disponible && processed == 0 && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de seguro de cuota',?,?,'ingreso_seguro_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            disponible,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +disponible;
          disponible = 0;
        }
      }

      /* 
      SI LLEGO ACA ES PORQUE QUEDA DISPONIBLE Y EVALUAMOS capital
      ---------------------------------- EN EL CASO DE QUE EL CAPITAL
      */

      if (
        obtenerIngresosPorTipoArray["ingreso_capital_cuotas"] < capital &&
        capital > 0
      ) {
        let processed = 0;

        capital =
          capital - obtenerIngresosPorTipoArray["ingreso_capital_cuotas"];

        // - Es igual al disponible inserta en cashflow, coloca el disponible en 0 y finaliza la operacion
        if (capital == disponible && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de capital de cuota',?,?,'ingreso_capital_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            capital,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          disponible = 0;
          newpayed += +capital;
        }

        // - Es menor al disponible inserta en cashflow, coloca el disponible en disponible - capital y sigue con la otra evaluacion de la operacion
        if (capital < disponible && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de capital de cuota',?,?,'ingreso_capital_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            capital,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          disponible = disponible - capital;
          processed = 1;
          newpayed += +capital;
        }

        // - Es mayor al disponible inserta en cashflow el capital, coloca en 0 el disponible y termina la operacion
        if (capital > disponible && processed == 0 && disponible > 0) {
          let cargar_pago_seguro = `INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso por pago de capital de cuota',?,?,'ingreso_capital_cuotas',?,?,?,?)`;
          await query(cargar_pago_seguro, [
            disponible,
            USER_ID,
            credit_id,
            credit_item_id,
            insertId,
            account_id,
            caja_id
          ]);
          newpayed += +disponible;
          disponible = 0;
        }
      }

      //Pago nota de débito

      if (obtenerIngresosPorTipoArray.ingreso_nota_debito < totalNotaDebitoCredito.egreso_nota_debito && disponible > 0) {
        const restanteNotaDebito = totalNotaDebitoCredito.egreso_nota_debito - obtenerIngresosPorTipoArray.ingreso_nota_debito
        let processedDebito = 0
        if (restanteNotaDebito == disponible && disponible > 0) {
          const pagoNotaDebito = await query(`INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso nota debito',?,?,'ingreso_nota_debito',?,?,?,?)`
            , [
              restanteNotaDebito,
              USER_ID,
              credit_id,
              credit_item_id,
              insertId,
              account_id,
              caja_id
            ])
          newpayed += +restanteNotaDebito
          disponible = 0

        } else if (restanteNotaDebito < disponible && disponible > 0) {
          const pagoNotaDebito = await query(`INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso nota debito',?,?,'ingreso_nota_debito',?,?,?,?)`
            , [
              restanteNotaDebito,
              USER_ID,
              credit_id,
              credit_item_id,
              insertId,
              account_id,
              caja_id
            ])
          disponible = disponible - restanteNotaDebito
          newpayed += +restanteNotaDebito
          processedDebito = 1

        } else if (restanteNotaDebito > disponible && processedDebito === 0 && disponible > 0) {
          const pagoNotaDebito = await query(`INSERT INTO cash_flow (type,amount,created_at,description,user,credit_id,operation_type,credit_item_id,payment_id,account_id,caja_id) VALUES (1,?,NOW(),'Ingreso nota debito',?,?,'ingreso_nota_debito',?,?,?,?)`
            , [
              disponible,
              USER_ID,
              credit_id,
              credit_item_id,
              insertId,
              account_id,
              caja_id
            ])
          newpayed += +disponible
          disponible = 0
        }
      }

      //Final pagos

      if ((Math.round(newpayed * 100) / 100) > 0) {
        const finalPayed = newpayed + +payed;

        payed_ci.push(credit_item_id);
        const prom = new Promise((resolve, reject) => {
          let sql = "UPDATE credits_items SET payed = ? WHERE id = ?";
          mysqli.query(sql, [finalPayed, credit_item_id], (err, data) => {
            if (err) {
              reject(e);
            } else {
              resolve(1);
            }
          });
        });
        promises.push(prom);
      }
    } // for

    const creditsItemsPayed = await query(
      "UPDATE payments SET payed_ci=? WHERE id = ?",
      [payed_ci.join(","), insertId]
    );

    if (payed_ci && payed_ci.length > 0) {
      await query(
        `DELETE FROM credit_history WHERE payment_id = ? AND credit_item_id NOT IN(${payed_ci.join(
          ","
        )})`,
        [insertId]
      );
    }
  } catch (e) {
    console.log(e);
    throw e;
  }
}

async function createNCreditOrDebit(
  client_id,
  payment_date,
  payment_amount,
  credit_id,
  account_id,
  notaCredito,
  description,
  USER_ID
) {
  try {
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    if (notaCredito.name === "nota de debito" || notaCredito.name === "nota de débito") {
      payment_amount = Number(payment_amount)
      if (notaCredito.id != null && notaCredito.id != undefined) {
        const sqlNotaDebito = `UPDATE credits_items SET nota_debito = nota_debito + ? where id = ?`
        resultND = await query(sqlNotaDebito, [payment_amount, notaCredito.id])
      }
    }
    const sql = `INSERT INTO payments ( clientID,paymentDate,amount,credit_id,account_id,payed_ci, description,responsable) VALUES (?,?,?,?,?,?,?,?)`;
    const sqlUpdate = `UPDATE credits_items SET payed = payed + ? where id = ?`

    const insertedPayment = await query(sql, [
      client_id,
      payment_date,
      payment_amount,
      Number(credit_id),
      Number(account_id),
      (notaCredito.id).toString(),
      description,
      USER_ID
    ]);
    if ((notaCredito.name === "nota de credito" || notaCredito.name === "nota de crédito") && notaCredito.id != null && notaCredito.id != undefined) {
      const updateCreditItem = await query(sqlUpdate, [
        Number(payment_amount),
        notaCredito.id
      ]);
    }

    return { response: insertedPayment }
  } catch (error) {
    return { error: error }
  }
}
function getNCreditoDebito(credit_id, callback) {
  let sql = `select sum(A.amount) as totalN,sum(A.amount) as contadorNotas,A.accountID,A.credit_item_id,A.name,A.payed_ci from (SELECT cf.credit_item_id,p.payed_ci as creditItem,p.*,c.name,c.id as accountID
    FROM cayetano.payments p 
    inner join  cayetano.cash_flow_accounts c on p.account_id = c.id 
    left join cayetano.cash_flow cf on p.payed_ci = cf.credit_item_id 
    where p.deleted_at is null and p.credit_id = ?
     and c.name in ("Nota de Crédito","Nota de Débito","Nota de Credito","Nota de Debito") group by p.id) A group by A.name, A.creditItem;`
  try {
    mysqli.query(sql, [credit_id], (err, rows) => {
      var response = [];
      if (rows) {
        response = rows;
      }
      return callback(err, response);
    });
  } catch (error) {
    return error;
  }
}

async function getList(credit_id) {
  try {
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    let sql = `
  select A.clientID,A.description, A.paymentDate, A.id, A.amount,A.account_id,A.credit_id, B.user,concat(D.name," " ,D.lastname) as responsable, B.payment_id , C.id as idUser, C.name, C.lastname , E.name as mediopago, A.payed_ci AS pagos
  from cayetano.payments A left join cayetano.cash_flow B on A.id = B.payment_id left join cayetano.users C  on B.user = C.id left join cayetano.users D  on A.responsable = D.id left join cayetano.cash_flow_accounts E on A.account_id = E.id 
  where A.credit_id = ? AND A.status = 1 group by A.id  ORDER BY paymentDate ASC;`;
    const result = await query(sql, [credit_id])
    if (Array.isArray(result) && result.length > 0) {
      const arrayPagos = await Promise.all(
        result.map(async (item) => {
          const quotes = await getPayed(item.pagos);
          if (Array.isArray(quotes) && quotes.length > 0) {
            item.cuotasPagas = quotes
          }
          return item
        }))
        console.log(arrayPagos)
      return arrayPagos
    }
  } catch (error) {
    return error
  }
}

function getListDeleted(credit_id, callback) {
  let sql =
    "SELECT payments.*,users.name,users.lastname FROM payments LEFT JOIN users ON payments.deletedByUser = users.id WHERE payments.credit_id = ? AND payments.deletedByUser IS NOT NULL AND payments.status = 0";
  console.log(sql);

  mysqli.query(sql, [credit_id], (err, rows) => {
    //si queremos imprimir el mensaje ponemos err.sqlMessage
    var response = [];
    if (rows) {
      response = rows;
    }
    return callback(err, response);
  });
}

function getInfo(paymentid, callback) {
  let sql = "SELECT * FROM payments WHERE id = ? LIMIT 1";

  mysqli.query(sql, [paymentid], (err, rows) => {
    //si queremos imprimir el mensaje ponemos err.sqlMessage
    var response = [];
    if (rows) {
      response = rows[0];
    }
    return callback(err, response);
  });
}

function updatePayment(amount, paymentDate, paymentid, callback) {
  let sql = "UPDATE payments SET paymentDate = ?,amount = ? WHERE id = ?";
  mysqli.query(sql, [paymentDate, amount, paymentid], (err, rows) => {
    //si queremos imprimir el mensaje ponemos err.sqlMessage
    var response = [];
    if (rows) {
      mysqli.query(
        "SELECT * FROM payments WHERE id = ?",
        [paymentid],
        (err2, rows2) => {
          if (rows2) {
            response = rows2[0];
            return callback(err, response);
          }
        }
      );
    }
  });
}

async function deletePayment(paymentid, reason, user_id, callback) {
  try {
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);

    // Traemos info del pago
    const paymentInfoQuery = `SELECT * FROM payments WHERE id = ? LIMIT 1;`;
    const paymentInfo = await query(paymentInfoQuery, [paymentid]);

    if (paymentInfo) {
      const credit_id = paymentInfo[0].credit_id;
      await query(
        `INSERT INTO record_logs (type,userId,createdAt,affectedId,credit_id) VALUES ('deleted-payment',?,NOW(),?,?)`,
        [user_id, paymentid, credit_id]
      );

      // Actualizamos el pago con estado inactivo y ponemos la fecha de eliminacion
      const deletePaymentQuery = await query(
        "UPDATE payments SET status = 0, deleted_at = NOW(), deletionReason = ?,deletedByUser = ? WHERE id = ?",
        [reason, user_id, paymentid]
      );

      if (deletePaymentQuery && deletePaymentQuery.affectedRows == 1) {
        await query(
          "UPDATE cash_flow SET deleted_at = NOW() WHERE payment_id = ?",
          [paymentid]
        );

        const getTotalsCashFlowDeleted = await query(
          "SELECT SUM(amount) pagado, credit_item_id FROM cash_flow WHERE payment_id = ? GROUP BY credit_item_id;",
          [paymentid]
        );

        console.log(`getTotalsCashFlowDeleted ${getTotalsCashFlowDeleted}`);

        if (getTotalsCashFlowDeleted && getTotalsCashFlowDeleted.length > 0) {
          getTotalsCashFlowDeleted.forEach(async (item) => {
            console.log(`item ${item}`);

            await query(
              `UPDATE credits_items SET payed = payed - ${item.pagado} WHERE credit_id = ? AND id = ?;`,
              [credit_id, item.credit_item_id]
            );
          });
        }

        return callback(null, deletePaymentQuery);
      } else {
        return callback("No se pudo eliminar el pago", null);
      }
    }
  } catch (error) {
    return callback(error, null);
  }
}

async function get(paymentid) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT CONCAT_WS(', ', u.lastname ,u.name ) name
                    , p.*
                    , count(ci.credit_id ) cuotas
                    FROM payments p
                    INNER JOIN credits c on c.id=p.credit_id
                    INNER JOIN users u on u.id =c.clientID
                    INNER JOIN credits_items ci on ci.credit_id=c.id
                    where p.id=?
                    GROUP BY c.id`;
  const payment = await query(dataQuery, [paymentid]);
  return payment[0];
}
async function getPayed(payed_ci) {
  const ci = payed_ci.split(",");
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);

  const query1 = `SELECT
  COUNT(credits_items.id) cuotastotales,
  subquery.primera_cuota
  FROM credits_items JOIN (SELECT
    credits.primera_cuota,
    credits.id
  FROM
    credits
    INNER JOIN credits_items ci ON ci.credit_id = credits.id 
  WHERE
    ci.id IN (?)
  LIMIT 1) subquery
  WHERE credits_items.credit_id = subquery.id
  ;`;
  const resultquery1 = await query(query1, [ci]);

  const dataQuery = `SELECT ci.*, COALESCE(SUM(p.amount),0) punitorios,CONCAT(TIMESTAMPDIFF( MONTH, ?, ci.period ) + 1,' de ${resultquery1[0].cuotastotales}') cuota,
                      CASE WHEN (ci.capital+ci.intereses+ci.nota_debito+ci.safe+COALESCE ( SUM( p.amount ),0)) > ci.payed THEN 'A CUENTA' ELSE 'CANCELADO' END accion
                      FROM credits_items ci
                      LEFT JOIN punitorios p ON ci.credit_id = p.credit_id AND ci.period = p.period
                      where ci.id IN(?) GROUP BY ci.period`;
  const credits_items = await query(dataQuery, [
    resultquery1[0].primera_cuota,
    ci,
  ]);
  return credits_items;
}
async function getPayed2(payed_ci, payment_id) {
  const ci = payed_ci.split(",");
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);

  const query1 = `SELECT
  COUNT(credits_items.id) cuotastotales,
  subquery.primera_cuota
  FROM credits_items JOIN (SELECT
    credits.primera_cuota,
    credits.id
  FROM
    credits
    INNER JOIN credits_items ci ON ci.credit_id = credits.id 
  WHERE
    ci.id IN (?)
  LIMIT 1) subquery
  WHERE credits_items.credit_id = subquery.id
  ;`;
  const resultquery1 = await query(query1, [ci]);

  const dataQuery = `SELECT ci.*, COALESCE(SUM(p.amount),0) punitorios,CONCAT(TIMESTAMPDIFF( MONTH, ?, ci.period ) + 1,' de ${resultquery1[0].cuotastotales}') cuota,
                      CASE WHEN (ci.capital+ci.intereses+ci.nota_debito+ci.safe+COALESCE ( SUM( p.amount ),0)) > ci.payed THEN 'A CUENTA' ELSE 'CANCELADO' END accion
                      FROM credits_items ci
                      LEFT JOIN punitorios p ON ci.credit_id = p.credit_id AND ci.period = p.period
                      where ci.id IN(?) GROUP BY ci.period`;
  const credits_items = await query(dataQuery, [
    resultquery1[0].primera_cuota,
    ci,
  ]);
  return credits_items;
}
module.exports = {
  get,
  getList,
  getListDeleted,
  getPayed,
  insertPayment,
  deletePayment,
  getInfo,
  updatePayment,
  createNCreditOrDebit,
  getNCreditoDebito
};

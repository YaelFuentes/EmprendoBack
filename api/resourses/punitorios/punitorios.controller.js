const { resolve } = require("path");
var commonFormulas = require("../common/formulas");

const isWeekend = (dateParam) => {
  dateParam = dateParam + " 00:00:01";
  dt = new Date(dateParam);
  if (dt.getDay() == 6 || dt.getDay() == 0) {
    return true;
  }
  return false;
};

async function calculate(credit_id) {
  const moment = require("moment");
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const promises = [];

  let sqlCredit =
    "SELECT total,cuotas FROM credits INNER JOIN budget on budget.id = credits.budget WHERE credits.id = ? LIMIT 1";
  const credit = await query(sqlCredit, [credit_id]);

  const capitalprestado = credit[0].total;
  const cuotas = credit[0].cuotas;
  console.log(capitalprestado);

  let sql =
    "SELECT * FROM credits_items WHERE credit_id = ? AND (amount+safe) > payed AND period < NOW()";
  let insertado = 0;
  const creditsItems = await query(sql, [credit_id]);

  try {
    for (
      let indexCredit = 0;
      indexCredit < creditsItems.length;
      indexCredit++
    ) {
      moment.duration().asDays();
      const today = moment();
      const initialperiod = creditsItems[indexCredit].period;
      const period = moment(creditsItems[indexCredit].period);
      const days = period.diff(today, "days");
      const payed = creditsItems[indexCredit].payed;
      const cuota =
        Number(creditsItems[indexCredit].amount) +
        Number(creditsItems[indexCredit].safe);
      const impago = Number(cuota) - Number(payed);

      let interes = 0;
      let fecha;
      if (Number(days) < 0) {
        let diasDeAtraso = 0;
        for (let index = 1; index <= Math.abs(days); index++) {
          fecha = moment(initialperiod).add(index, "days").format("YYYY-MM-DD");
          if (!isWeekend(fecha)) {
            diasDeAtraso++;
          }
        }

        if (diasDeAtraso > 0) {
          console.log("cuota", cuota);

          let interes = commonFormulas.calcularPunitorios(cuota, diasDeAtraso);

          console.log("INTERES", interes);

          let gastoAdministrativo = 650;
          interes += gastoAdministrativo;

          let sqlCheck =
            "SELECT id FROM punitorios WHERE period = ? and credit_id = ?";
          const sqlCheckResult = await query(sqlCheck, [
            initialperiod,
            credit_id,
          ]);

          if (sqlCheckResult.length > 0) {
            console.log("UPDATE dias de atraso", diasDeAtraso);
            let sqlUpdate =
              "UPDATE punitorios SET amount = ?, days_past = ? WHERE period = ? AND credit_id = ?";
            await query(sqlUpdate, [
              interes,
              diasDeAtraso,
              initialperiod,
              credit_id,
            ]);
          } else {
            let sqlInsert =
              "INSERT IGNORE INTO punitorios (fecha,amount,credit_id,period,days_past) VALUES (?,?,?,?,?)";
            await query(sqlInsert, [
              fecha,
              interes,
              credit_id,
              initialperiod,
              diasDeAtraso,
            ]);
          }
          let sqlUpdate2 =
            "UPDATE credits_items SET punitorios = ?, update_by_cron = NOW() WHERE id = ?";
          await query(sqlUpdate2, [interes, creditsItems[indexCredit].id]);
        }
      } // if
    } //foreach
  } catch (error) {
    console.log(error);
  }

  return Promise.all(promises).then((values) => {
    console.log("ALL PROMISES");
    return {
      calculated: insertado,
    };
  });
}

// TODO rehacer esta funcion
function calculateAll() {
  var punitoriosClass = new Punitorios(mysqli);

  let sql =
    "SELECT credit_id FROM credits_items WHERE (amount+safe) > payed AND period < NOW() GROUP BY credit_id";
  mysqli.query(sql, [], (err, rows) => {
    rows.forEach(function (row) {
      let credit_id = row.credit_id;
      punitoriosClass.calculate(credit_id, function (err, result) {});
    });
  });
}

function getByCreditAndPeriod(credit_id, period, callback) {
  const moment = require("moment");
  const periodo = moment(period).format("YYYY-MM-DD");
  //console.log(periodo);
  const sql =
    "SELECT * FROM punitorios WHERE credit_id = ? AND period = ? ORDER BY id ASC";
  //console.log(sql);

  mysqli.query(sql, [credit_id, periodo], (err, rows) => {
    //si queremos imprimir el mensaje ponemos err.sqlMessage
    var response = [];
    if (rows) {
      response = rows;
    }
    return callback(err, response);
  });
}

function updateByCreditAndPeriod(credit_id, period, amount, callback) {
  const moment = require("moment");
  const periodo = moment(period).format("YYYY-MM-DD");
  //console.log(periodo);
  const sql =
    "SELECT COUNT(id) cantidad FROM punitorios WHERE credit_id = ? AND period = ?;";
  //console.log(sql);

  mysqli.query(sql, [credit_id, periodo], (err, rows) => {
    const cuotas = rows[0].cantidad;
    const cuota = (Number(amount) / Number(cuotas)).toFixed(2);

    console.log("cuotas", cuotas);
    mysqli.query(
      "UPDATE punitorios SET amount = ? WHERE credit_id = ? AND period = ?",
      [cuota, credit_id, periodo],
      (err, result) => {
        return callback(err, result);
      }
    );
  });
}

module.exports = {
  calculate,
  getByCreditAndPeriod,
  updateByCreditAndPeriod,
};

const { NotFoundError } = require('../lib/errors');

module.exports = func => async (req, res) => {
  try {
    await func(req, res);
  }
  catch (err) {
    if (err instanceof NotFoundError) {
      return res.sendStatus(404);
    }
    console.error(err);
    res.status(500).send(`Error: ${err.message}`);
  }
};

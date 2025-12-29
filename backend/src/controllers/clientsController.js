const clientModel = require('../models/clientModel');

const lookup = async (req, res, next) => {
  try {
    const { email, phone } = req.query;
    if (!email && !phone) return res.status(400).json({ error: 'email or phone required' });

    if (email) {
      const c = await clientModel.getClientByEmail(email);
      if (c) return res.json({ client: c });
    }

    if (phone) {
      const c = await clientModel.getClientByPhone(phone);
      if (c) return res.json({ client: c });
    }

    return res.status(404).json({ error: 'not found' });
  } catch (err) {
    next(err);
  }
};

module.exports = { lookup };

const Settings = require('../models/Settings');
const { invalidateSettingsCache } = require('../utils/getSettings');

const KEY = 'global';

const getSettings = async (req, res) => {
  try {
    // Atomic upsert — safe under concurrent requests.
    // If two requests arrive at once on a fresh DB, MongoDB handles
    // the race; only one doc is created, both get the same result.
    const settings = await Settings.findOneAndUpdate(
      { key: KEY },
      {
        $setOnInsert: {
          key: KEY,
          seller: {
            name: 'CORVEX STEEL WIRES',
            address: 'Plot 12, Industrial Area, City, PIN',
            state: 'Delhi',
            stateCode: '07',
            gstin: '07ABCDE1234F1Z5',
          },
          invoice: { defaultHsn: '7217' },
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    console.error('[getSettings]', err);
    res.status(500).json({
      success: false,
      message: 'Failed to load settings',
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const allowed = ['seller', 'bank', 'invoice', 'numbering', 'preferences'];
    const updates = {};

    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    updates.updatedBy = req.user?._id;

    const settings = await Settings.findOneAndUpdate(
      { key: KEY },
      { $set: updates },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    invalidateSettingsCache();
    res.status(200).json({
      success: true,
      message: 'Settings saved',
      data: settings,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map((e) => e.message).join('; ');
      return res.status(400).json({
        success: false,
        message: msg,
      });
    }

    console.error('[updateSettings]', err);
    res.status(500).json({
      success: false,
      message: 'Failed to save settings',
    });
  }
};

module.exports = { getSettings, updateSettings };
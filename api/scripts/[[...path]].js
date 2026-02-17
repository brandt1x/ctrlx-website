/**
 * Block direct access to script files. Scripts are served only via /api/download
 * after purchase verification.
 */
module.exports = (req, res) => {
	res.status(403).json({ error: 'Forbidden' });
};

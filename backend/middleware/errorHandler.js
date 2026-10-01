// Central error handler: logs details on the server, never leaks raw database errors to users.
module.exports = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request data.' });
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ message: 'Please check the information you entered.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
};

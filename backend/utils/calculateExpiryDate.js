const calculateExpiryDate = (expiryType, expiryValue, customDate) => {
  if (expiryType === 'custom' && customDate) {
    return new Date(customDate);
  } else if (expiryType === 'duration' && expiryValue) {
    const now = new Date();
    return new Date(now.getTime() + (expiryValue * 60 * 60 * 1000)); // hours to milliseconds
  }
  return null;
};
module.exports = calculateExpiryDate;
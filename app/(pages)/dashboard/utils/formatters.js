// Utility functions for formatting data

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('nl-NL');
};

// Helper function to calculate object size in bytes
export const calculateObjectSize = (obj) => {
  if (obj === null || obj === undefined) return 0;
  
  const jsonString = JSON.stringify(obj);
  // UTF-8 encoding: each character can be 1-4 bytes, rough estimate
  return new Blob([jsonString]).size;
};

// Helper function to format bytes to human readable format
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Calculate data sizes
export const getDataSizes = (allRecords, data) => {
  const allRecordsSize = calculateObjectSize(allRecords);
  const dataSize = calculateObjectSize(data);
  const totalSize = allRecordsSize + dataSize;
  
  return {
    allRecords: {
      size: allRecordsSize,
      formatted: formatBytes(allRecordsSize),
      count: allRecords ? allRecords.length : 0
    },
    transformedData: {
      size: dataSize,
      formatted: formatBytes(dataSize)
    },
    total: {
      size: totalSize,
      formatted: formatBytes(totalSize)
    }
  };
};

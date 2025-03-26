// src/components/recommendation/EmptyResults.js
import React from 'react';
import { Box, Typography } from '@mui/material';

const EmptyResults = ({ message, suggestion }) => {
  return (
    <Box 
      sx={{ 
        textAlign: 'center', 
        py: 6, 
        backgroundColor: '#f9f9f9',
        borderRadius: 2,
        border: '1px dashed #ddd',
        my: 2
      }}
    >
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {message}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {suggestion}
      </Typography>
    </Box>
  );
};

export default EmptyResults;

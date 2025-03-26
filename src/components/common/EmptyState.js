// src/components/common/EmptyState.js
import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import { motion } from 'framer-motion';

const EmptyState = ({ 
  icon, 
  title, 
  description, 
  actionButtons = [],
  animationVariants = null
}) => {
  return (
    <motion.div
      initial={animationVariants?.hidden || { opacity: 0 }}
      animate={animationVariants?.visible || { opacity: 1 }}
      exit={animationVariants?.exit || { opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center'
        }}
      >
        {icon && (
          <Box sx={{ mb: 3, color: 'text.secondary' }}>
            {icon}
          </Box>
        )}
        
        {title && (
          <Typography variant="h5" component="h2" gutterBottom>
            {title}
          </Typography>
        )}
        
        {description && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
            {description}
          </Typography>
        )}
        
        {actionButtons.length > 0 && (
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {actionButtons.map((button, index) => (
              <Button
                key={index}
                variant={button.variant || "outlined"}
                color={button.color || "primary"}
                size={button.size || "medium"}
                startIcon={button.icon}
                onClick={button.onClick}
                disabled={button.disabled}
              >
                {button.label}
              </Button>
            ))}
          </Stack>
        )}
      </Box>
    </motion.div>
  );
};

export default EmptyState;

// src/components/search/Autocomplete.js
import React from 'react';
import { List, ListItem, ListItemIcon, ListItemText, Paper } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

const Autocomplete = ({ suggestions, onSelect, maxHeight = 300 }) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        mt: 1, 
        maxHeight, 
        overflow: 'auto',
        width: '100%',
        position: 'absolute',
        zIndex: 1100
      }}
    >
      <List dense>
        {suggestions.map((suggestion, index) => (
          <ListItem 
            key={index} 
            button 
            onClick={() => onSelect(suggestion)}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <SearchIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText primary={suggestion} />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default Autocomplete;

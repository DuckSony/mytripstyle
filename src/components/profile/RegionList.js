// src/components/profile/RegionList.js
import React from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Divider,
  Button,
  Alert
} from '@mui/material';
import { 
  Delete as DeleteIcon,
  LocationOn as LocationOnIcon,
  Edit as EditIcon,
  Add as AddIcon
} from '@mui/icons-material';

const RegionList = ({ 
  selectedRegions = [], 
  onRegionsChange,
  onAddClick, 
  onEditClick,
  showEditButtons = true 
}) => {
  // 지역 제거 핸들러
  const handleRemoveRegion = (regionId) => {
    const newSelectedRegions = selectedRegions.filter(region => region.id !== regionId);
    onRegionsChange(newSelectedRegions);
  };

  // 지역이 없는 경우 메시지
  if (selectedRegions.length === 0) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          선택된 관심 지역이 없습니다. 새로운 지역을 추가해보세요.
        </Alert>
        
        {showEditButtons && (
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />}
            onClick={onAddClick}
            fullWidth
          >
            관심 지역 추가하기
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">관심 지역 목록</Typography>
        
        {showEditButtons && (
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<AddIcon />}
            onClick={onAddClick}
          >
            추가
          </Button>
        )}
      </Box>
      
      <Paper variant="outlined">
        <List dense sx={{ width: '100%', bgcolor: 'background.paper' }}>
          {selectedRegions.map((region, index) => (
            <React.Fragment key={region.id}>
              {index > 0 && <Divider component="li" />}
              <ListItem>
                <LocationOnIcon color="primary" sx={{ mr: 1.5, fontSize: 20 }} />
                <ListItemText 
                  primary={region.subRegion ? region.subRegion : region.region}
                  secondary={region.subRegion ? region.region : null}
                />
                
                {showEditButtons && (
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      aria-label="edit"
                      onClick={() => onEditClick()}
                      sx={{ mr: 1 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleRemoveRegion(region.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default RegionList;

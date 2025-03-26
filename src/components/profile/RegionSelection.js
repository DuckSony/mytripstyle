// src/components/profile/RegionSelection.js
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Button,
  Alert
} from '@mui/material';
import RegionSelector from './RegionSelector';
import RegionList from './RegionList';

const RegionSelection = ({ selectedRegions = [], onRegionsChange }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [tempSelectedRegions, setTempSelectedRegions] = useState([]);
  
  // 다이얼로그 열기 핸들러
  const handleOpenDialog = () => {
    setTempSelectedRegions([...selectedRegions]);
    setOpenDialog(true);
  };
  
  // 다이얼로그 닫기 핸들러
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  
  // 다이얼로그에서 선택 완료 핸들러
  const handleConfirmSelection = () => {
    onRegionsChange(tempSelectedRegions);
    setOpenDialog(false);
  };
  
  // 임시 선택 지역 변경 핸들러
  const handleTempRegionsChange = (newRegions) => {
    setTempSelectedRegions(newRegions);
  };

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        관심 있는 지역을 선택해주세요
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        선택한 관심 지역을 기반으로 맞춤형 추천을 제공합니다. 자주 방문하거나 관심 있는 지역을 선택해주세요.
      </Typography>
      
      {selectedRegions.length === 0 ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            관심 지역을 선택하면 해당 지역의 추천 장소를 볼 수 있습니다.
          </Alert>
          <Button variant="contained" onClick={handleOpenDialog} fullWidth>
            관심 지역 선택하기
          </Button>
        </Box>
      ) : (
        <RegionList 
          selectedRegions={selectedRegions}
          onRegionsChange={onRegionsChange}
          onAddClick={handleOpenDialog}
          onEditClick={handleOpenDialog}
        />
      )}
      
      {/* 지역 선택 다이얼로그 */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>관심 지역 선택</DialogTitle>
        <DialogContent dividers>
          <RegionSelector 
            selectedRegions={tempSelectedRegions}
            onRegionsChange={handleTempRegionsChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button variant="contained" onClick={handleConfirmSelection}>
            선택 완료 ({tempSelectedRegions.length}개)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegionSelection;

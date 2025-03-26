// src/components/profile/RegionSelector.js
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  LocationOn as LocationOnIcon
} from '@mui/icons-material';
import regionsData, { getAllRegions } from '../../data/regions';

// 선택한 지역이 이미 있는지 확인하는 함수
const isRegionSelected = (selectedRegions, region) => {
  return selectedRegions.some(selectedRegion => 
    (selectedRegion.id === region.id) || 
    (selectedRegion.subRegionId === region.id)
  );
};

const RegionSelector = ({ selectedRegions = [], onRegionsChange }) => {
  // 디버깅 로그 추가
  console.log("RegionSelector 렌더링, 선택된 지역:", selectedRegions);
  
  const [expandedPanel, setExpandedPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const allRegions = getAllRegions();

  // 검색어 변경 시 검색 결과 업데이트
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
  
    const results = allRegions.filter(region => 
      region.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSearchResults(results);
  }, [searchTerm, allRegions]);

  // 아코디언 패널 확장/축소 핸들러
  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  // 대권역 선택 핸들러
  const handleMainRegionSelect = (event, region) => {
    const checked = event.target.checked;
    let newSelectedRegions = [...selectedRegions];
    
    if (checked) {
      // 이미 선택되어 있지 않은 경우에만 추가
      if (!isRegionSelected(selectedRegions, region)) {
        newSelectedRegions.push({
          id: region.id,
          region: region.name,
          coordinates: region.coordinates
        });
      }
    } else {
      // 대권역 제거 및 관련 세부권역도 모두 제거
      newSelectedRegions = newSelectedRegions.filter(r => 
        r.id !== region.id && r.parentId !== region.id
      );
    }
    
    // 디버깅 로그 추가
    console.log("대권역 선택 업데이트:", newSelectedRegions);
    onRegionsChange(newSelectedRegions);
  };

  // 세부권역 선택 핸들러
  const handleSubRegionSelect = (event, mainRegion, subRegion) => {
    const checked = event.target.checked;
    let newSelectedRegions = [...selectedRegions];
    
    if (checked) {
      // 이미 선택되어 있지 않은 경우에만 추가
      const subRegionObj = {
        id: `${mainRegion.id}_${subRegion.id}`,
        region: mainRegion.name,
        subRegion: subRegion.name,
        subRegionId: subRegion.id,
        parentId: mainRegion.id,
        coordinates: mainRegion.coordinates // 세부 좌표가 없으면 대권역 좌표 사용
      };
      
      if (!isRegionSelected(selectedRegions, subRegionObj)) {
        newSelectedRegions.push(subRegionObj);
      }
    } else {
      // 세부권역 제거
      newSelectedRegions = newSelectedRegions.filter(r => 
        !(r.parentId === mainRegion.id && r.subRegionId === subRegion.id)
      );
    }
    
    // 디버깅 로그 추가
    console.log("세부권역 선택 업데이트:", newSelectedRegions);
    onRegionsChange(newSelectedRegions);
  };

  // 검색 결과에서 지역 선택 핸들러
  const handleSearchResultSelect = (region) => {
    let newSelectedRegions = [...selectedRegions];
    
    if (region.parentId) {
      // 세부권역인 경우
      const mainRegion = regionsData.find(r => r.id === region.parentId);
      const subRegion = mainRegion.subRegions.find(sr => sr.id === region.id);
      
      if (subRegion) {
        const subRegionObj = {
          id: `${mainRegion.id}_${subRegion.id}`,
          region: mainRegion.name,
          subRegion: subRegion.name,
          subRegionId: subRegion.id,
          parentId: mainRegion.id,
          coordinates: mainRegion.coordinates
        };
        
        if (!isRegionSelected(selectedRegions, subRegionObj)) {
          newSelectedRegions.push(subRegionObj);
        }
      }
    } else {
      // 대권역인 경우
      if (!isRegionSelected(selectedRegions, region)) {
        newSelectedRegions.push({
          id: region.id,
          region: region.name,
          coordinates: region.coordinates
        });
      }
    }
    
    // 디버깅 로그 추가
    console.log("검색 결과에서 지역 선택:", newSelectedRegions);
    onRegionsChange(newSelectedRegions);
    setSearchTerm(''); // 검색어 초기화
  };

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        관심 있는 지역을 선택해주세요
      </Typography>
      
      {/* 검색 필드 */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="지역 검색"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        margin="normal"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        size="small"
      />
      
      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'background.paper', mb: 2 }}>
          {searchResults.map((region) => (
            <ListItem 
              key={region.id + (region.parentId || '')}
              button
              onClick={() => handleSearchResultSelect(region)}
            >
              <ListItemText 
                primary={
                  <Box display="flex" alignItems="center">
                    <LocationOnIcon fontSize="small" sx={{ mr: 1 }} />
                    {region.parentName ? `${region.parentName} - ${region.name}` : region.name}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
      
      {/* 선택된 지역 칩 표시 */}
      {selectedRegions.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {selectedRegions.map((region) => (
            <Chip
              key={region.id}
              label={region.subRegion ? `${region.region} - ${region.subRegion}` : region.region}
              onDelete={() => {
                const newSelectedRegions = selectedRegions.filter(r => r.id !== region.id);
                // 디버깅 로그 추가
                console.log("지역 삭제:", newSelectedRegions);
                onRegionsChange(newSelectedRegions);
              }}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}
      
      <Divider sx={{ my: 2 }} />
      
      {/* 권역별 아코디언 */}
      {regionsData.map((region) => (
        <Accordion 
          key={region.id}
          expanded={expandedPanel === region.id}
          onChange={handleAccordionChange(region.id)}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`${region.id}-content`}
            id={`${region.id}-header`}
          >
            <FormControlLabel
              control={
                <Checkbox 
                  checked={selectedRegions.some(r => r.id === region.id)}
                  onChange={(e) => handleMainRegionSelect(e, region)}
                  onClick={(e) => e.stopPropagation()}
                />
              }
              label={region.name}
              onClick={(e) => e.stopPropagation()}
            />
          </AccordionSummary>
          <AccordionDetails sx={{ pl: 4 }}>
            <Box>
              {region.subRegions.map((subRegion) => (
                <FormControlLabel
                  key={subRegion.id}
                  control={
                    <Checkbox 
                      checked={selectedRegions.some(r => 
                        r.parentId === region.id && r.subRegionId === subRegion.id
                      )}
                      onChange={(e) => handleSubRegionSelect(e, region, subRegion)}
                      size="small"
                    />
                  }
                  label={subRegion.name}
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default RegionSelector;

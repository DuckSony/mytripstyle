// src/components/recommendation/FilterBar.js
import React from 'react';
import { 
  Box, Paper, Grid, FormControl, InputLabel, 
  Select, MenuItem, IconButton 
} from '@mui/material';
import { FilterList as FilterListIcon } from '@mui/icons-material';

const FilterBar = ({ filters, onFilterChange, showFilters, onToggleFilters, isNearbyTab }) => {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <IconButton 
          onClick={onToggleFilters}
          color={showFilters ? "primary" : "default"}
          aria-label="필터 토글"
        >
          <FilterListIcon />
        </IconButton>
      </Box>
      
      {showFilters && (
        <Paper sx={{ 
          p: 2, 
          mb: 2, 
          transition: 'all 0.3s ease',
          boxShadow: 2
        }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>카테고리</InputLabel>
                <Select
                  value={filters.category}
                  onChange={(e) => onFilterChange('category', e.target.value)}
                  label="카테고리"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="cafe">카페</MenuItem>
                  <MenuItem value="restaurant">식당</MenuItem>
                  <MenuItem value="culture">문화 공간</MenuItem>
                  <MenuItem value="bookstore_cafe">북카페</MenuItem>
                  <MenuItem value="bar">바/펍</MenuItem>
                  <MenuItem value="art_cafe">아트 카페</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>거리</InputLabel>
                <Select
                  value={filters.distance}
                  onChange={(e) => onFilterChange('distance', e.target.value)}
                  label="거리"
                  disabled={!isNearbyTab}
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="1000">1km 이내</MenuItem>
                  <MenuItem value="3000">3km 이내</MenuItem>
                  <MenuItem value="5000">5km 이내</MenuItem>
                  <MenuItem value="10000">10km 이내</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>평점</InputLabel>
                <Select
                  value={filters.rating}
                  onChange={(e) => onFilterChange('rating', e.target.value)}
                  label="평점"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="3">3점 이상</MenuItem>
                  <MenuItem value="4">4점 이상</MenuItem>
                  <MenuItem value="4.5">4.5점 이상</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default FilterBar;

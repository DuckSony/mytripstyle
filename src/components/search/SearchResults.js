// src/components/search/SearchResults.js
import React from 'react';
import { Grid, Typography, Box } from '@mui/material';
import PlaceCard from '../recommendation/PlaceCard';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../../contexts/SearchContext';

const SearchResults = ({ results }) => {
  const navigate = useNavigate();
  
  // useSearch 훅 사용 - 안전하게 기본값 처리
  const {
    searchResults = []
  } = useSearch() || {};
  
  // props로 전달된 results가 있으면 우선 사용, 없으면 context의 검색 결과 사용
  const displayResults = results && results.length > 0 ? results : searchResults;
  
  if (!displayResults || displayResults.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1">검색 결과가 없습니다.</Typography>
      </Box>
    );
  }
  
  return (
    <Grid container spacing={2}>
      {displayResults.map((place) => (
        <Grid item xs={12} sm={6} md={4} key={place.id || `place-${Math.random()}`}>
          <PlaceCard 
            place={place}
            onClick={() => navigate(`/place/${place.id}`)}
          />
        </Grid>
      ))}
    </Grid>
  );
};

export default SearchResults;

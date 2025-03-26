// src/components/profile/ProfileImageEditor.js
import React, { useState } from 'react';
import { 
  Box, 
  Avatar, 
  IconButton, 
  CircularProgress, 
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';
import { uploadProfileImage } from '../../services/userService';

const ProfileImageEditor = ({ currentPhotoURL, onImageUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [openPreview, setOpenPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const handleImageSelect = (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    setSelectedFile(file);
    
    // 이미지 미리보기
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result);
      setOpenPreview(true);
    };
    reader.readAsDataURL(file);
  };
  
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError('');
    
    try {
      const result = await uploadProfileImage(selectedFile);
      if (result.success) {
        onImageUpdate(result.data.photoURL);
        setOpenPreview(false);
      } else {
        setError(result.error || '업로드 실패');
      }
    } catch (err) {
      setError('이미지 업로드 중 오류가 발생했습니다.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };
  
  const cancelUpload = () => {
    setOpenPreview(false);
    setSelectedFile(null);
    setPreviewImage(null);
  };
  
  return (
    <>
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <Avatar
          src={currentPhotoURL}
          alt="프로필 이미지"
          sx={{ 
            width: 100, 
            height: 100, 
            border: '2px solid', 
            borderColor: 'primary.light' 
          }}
        />
        
        <input
          accept="image/*"
          id="profile-image-input"
          type="file"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />
        
        <label htmlFor="profile-image-input">
          <IconButton
            component="span"
            sx={{
              position: 'absolute',
              right: -5,
              bottom: -5,
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
              width: 32,
              height: 32,
            }}
            disabled={uploading}
          >
            <PhotoCamera fontSize="small" />
          </IconButton>
        </label>
      </Box>
      
      {/* 이미지 미리보기 다이얼로그 */}
      <Dialog open={openPreview} onClose={cancelUpload}>
        <DialogTitle>프로필 이미지 미리보기</DialogTitle>
        <DialogContent>
          {previewImage && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Avatar 
                src={previewImage} 
                alt="미리보기" 
                sx={{ width: 150, height: 150, mb: 2 }}
              />
              {error && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {error}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelUpload} color="primary" disabled={uploading}>
            취소
          </Button>
          <Button 
            onClick={handleUpload} 
            color="primary" 
            variant="contained"
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : null}
          >
            {uploading ? '업로드 중...' : '적용하기'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProfileImageEditor;

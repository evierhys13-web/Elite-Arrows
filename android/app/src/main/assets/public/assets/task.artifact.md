# Task: Fix Upload Bottlenecks in Result Submission

The goal is to improve the reliability and performance of match result submissions, particularly when uploading proof images and videos.

## Todos
- [ ] Research and Prepare Firebase Storage exports <!-- id: 0 -->
- [ ] Refactor `SubmitResult.jsx` for binary uploads and progress tracking <!-- id: 1 -->
	- [ ] Update state to handle `File`/`Blob` objects <!-- id: 2 -->
	- [ ] Refactor `handleImageUpload` to output `Blob` <!-- id: 3 -->
	- [ ] Refactor `handleVideoUpload` to store `File` object <!-- id: 4 -->
	- [ ] Implement resumable binary uploads with progress tracking <!-- id: 5 -->
	- [ ] Update UI to display upload progress <!-- id: 6 -->
- [ ] Verify the fixes <!-- id: 7 -->

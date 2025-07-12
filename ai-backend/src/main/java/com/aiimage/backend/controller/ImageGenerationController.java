package com.aiimage.backend.controller;

import com.aiimage.backend.dto.GenerateImageRequest;
import com.aiimage.backend.dto.GenerateImageResponse;
import com.aiimage.backend.service.ImageGenerationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
public class ImageGenerationController {

    private static final Logger logger = LoggerFactory.getLogger(ImageGenerationController.class);

    @Autowired
    private ImageGenerationService imageGenerationService;

    @PostMapping("/generate")
    public ResponseEntity<GenerateImageResponse> generateImage(
            @RequestBody GenerateImageRequest request) {
        
        try {
            String imageUrl = imageGenerationService.generateImage(request.getPrompt());
            
            GenerateImageResponse response = new GenerateImageResponse();
            response.setImageUrl(imageUrl);
            response.setPrompt(request.getPrompt());
            response.setStatus("success");
            response.setTimestamp(System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            GenerateImageResponse errorResponse = new GenerateImageResponse();
            errorResponse.setStatus("error");
            errorResponse.setError("Failed to generate image: " + e.getMessage());
            errorResponse.setTimestamp(System.currentTimeMillis());
            
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("AI Backend is running!");
    }

    @GetMapping("/models")
    public ResponseEntity<Object> getAvailableModels() {
        return ResponseEntity.ok(imageGenerationService.getAvailableModels());
    }

    // Add image serving endpoint
    @GetMapping("/images/{filename}")
    public ResponseEntity<Resource> getImage(@PathVariable String filename) {
        try {
            logger.info("Serving image: {}", filename);
            String filepath = "generated-images/" + filename;
            File file = new File(filepath);
            
            if (!file.exists()) {
                logger.warn("Image file not found: {}", filepath);
                return ResponseEntity.notFound().build();
            }
            
            logger.info("Image file found, serving: {}", filepath);
            FileSystemResource resource = new FileSystemResource(file);
            
            return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
                
        } catch (Exception e) {
            logger.error("Error serving image: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
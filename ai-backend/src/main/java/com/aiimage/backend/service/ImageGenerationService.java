package com.aiimage.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.springframework.core.ParameterizedTypeReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.io.File;
import java.io.FileOutputStream;

@Service
public class ImageGenerationService {

    private static final Logger logger = LoggerFactory.getLogger(ImageGenerationService.class);
    
    @Value("${local.model.url:http://localhost:7860}")
    private String localModelUrl;
    
    private final RestTemplate restTemplate;
    private final String imageStoragePath = "generated-images/";

    public ImageGenerationService() {
        this.restTemplate = new RestTemplate();
        createImageDirectory();
    }

    private void createImageDirectory() {
        try {
            File dir = new File(imageStoragePath);
            if (!dir.exists()) {
                dir.mkdirs();
                logger.info("Created image storage directory: {}", imageStoragePath);
            }
        } catch (Exception e) {
            logger.error("Failed to create image directory", e);
        }
    }

    /**
     * Enhances prompt for regular image generation to ensure subject is fully in frame
     */
    private String enhancePromptForFraming(String originalPrompt) {
        // Add framing keywords to ensure complete subject visibility
        String framingEnhancement = ", full view, complete subject, fully in frame, not cropped, " +
                                   "entire object visible, wide shot, nothing cut off, well framed, " +
                                   "subject completely visible, full composition, properly framed";
        
        String enhancedPrompt = originalPrompt + framingEnhancement;
        
        logger.info("Original prompt: {}", originalPrompt);
        logger.info("Enhanced prompt with framing: {}", enhancedPrompt);
        
        return enhancedPrompt;
    }

    /**
     * Gets negative prompt for regular image generation to avoid cropping
     */
    private String getFramingNegativePrompt() {
        return "cropped, cut off, partial view, incomplete, truncated, edges cut, " +
               "frame cutting, not fully visible, missing parts, cropped out, " +
               "cut off edges, partial object, blurry, low quality";
    }

    public String generateImage(String prompt) throws Exception {
        logger.info("Generating image for prompt: {}", prompt);

        try {
            // Try local model first
            String result = generateWithLocalModel(prompt);
            if (result != null) {
                return result;
            }
        } catch (Exception e) {
            logger.warn("Local model failed: {}", e.getMessage());
        }

        // Fallback to placeholder
        logger.warn("Local model failed, using placeholder");
        return generatePlaceholderImage();
    }

    private String generateWithLocalModel(String prompt) {
        try {
            logger.info("Calling local Stable Diffusion API with prompt: {}", prompt);
            
            // Enhance prompt for better framing
            String enhancedPrompt = enhancePromptForFraming(prompt);
            String negativePrompt = getFramingNegativePrompt();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Automatic1111 API format with enhanced prompts
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("prompt", enhancedPrompt);
            requestBody.put("negative_prompt", negativePrompt);
            requestBody.put("steps", 10);  // Keep original steps
            requestBody.put("width", 512);
            requestBody.put("height", 512);
            requestBody.put("cfg_scale", 7);
            requestBody.put("sampler_name", "DPM++ 2M");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            logger.info("Sending request to local model, waiting for completion...");
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                localModelUrl + "/sdapi/v1/txt2img",
                HttpMethod.POST,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                logger.info("Response body keys: {}", responseBody.keySet());
                
                Object images = responseBody.get("images");
                logger.info("Images object type: {}", images != null ? images.getClass().getSimpleName() : "null");
                
                if (images instanceof List<?> imagesList && !imagesList.isEmpty()) {
                    logger.info("Number of images: {}", imagesList.size());
                    String base64Image = (String) imagesList.get(0);
                    logger.info("Base64 image length: {}", base64Image != null ? base64Image.length() : 0);
                    
                    if (base64Image != null && !base64Image.isEmpty()) {
                        byte[] imageBytes = Base64.getDecoder().decode(base64Image);
                        String imageUrl = saveImageBytes(imageBytes);
                        logger.info("Successfully generated image with local model");
                        return imageUrl;
                    }
                } else {
                    logger.warn("No images in response or wrong format");
                }
            }

            return null;

        } catch (Exception e) {
            logger.error("Local model error: {}", e.getMessage());
            throw new RuntimeException("Local model failed: " + e.getMessage());
        }
    }

    private String saveImageBytes(byte[] imageBytes) throws Exception {
        try {
            String filename = "local_" + System.currentTimeMillis() + ".png";
            String filepath = imageStoragePath + filename;
            
            try (FileOutputStream fos = new FileOutputStream(filepath)) {
                fos.write(imageBytes);
            }
            
            logger.info("Saved image to: {}", filepath);
            // Fixed: Changed port from 8081 to 8080 to match the running backend
            return "http://localhost:8080/api/images/" + filename;
            
        } catch (Exception e) {
            logger.error("Failed to save image", e);
            throw e;
        }
    }

    private String generatePlaceholderImage() {
        return "https://picsum.photos/512/512?random=" + System.currentTimeMillis();
    }

    public Map<String, Object> getAvailableModels() {
        Map<String, Object> models = new HashMap<>();
        List<Map<String, String>> modelList = new ArrayList<>();
        
        // Check if local model is available
        try {
            restTemplate.getForObject(localModelUrl + "/sdapi/v1/options", String.class);
            
            Map<String, String> localModel = new HashMap<>();
            localModel.put("name", "Local Stable Diffusion");
            localModel.put("description", "Unlimited local image generation");
            localModel.put("provider", "local");
            localModel.put("status", "ready");
            modelList.add(localModel);
            
        } catch (Exception e) {
            logger.warn("Local model not available: {}", e.getMessage());
            
            Map<String, String> localModel = new HashMap<>();
            localModel.put("name", "Local Stable Diffusion");
            localModel.put("description", "Start webui-user.bat to enable");
            localModel.put("provider", "local");
            localModel.put("status", "offline");
            modelList.add(localModel);
        }
        
        Map<String, String> placeholder = new HashMap<>();
        placeholder.put("name", "Placeholder");
        placeholder.put("description", "Fallback images");
        placeholder.put("provider", "placeholder");
        placeholder.put("status", "ready");
        modelList.add(placeholder);
        
        models.put("models", modelList);
        models.put("total", modelList.size());
        models.put("activeProvider", "local");
        
        return models;
    }
}
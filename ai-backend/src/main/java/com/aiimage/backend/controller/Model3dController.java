package com.aiimage.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.ParameterizedTypeReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Base64;
import java.io.FileOutputStream;

@RestController
@RequestMapping("/api/3d")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
public class Model3dController {

    private static final Logger logger = LoggerFactory.getLogger(Model3dController.class);

    @Value("${triposr.api.url:http://localhost:5000}")
    private String TRIPOSR_API_URL;
    
    @Value("${local.model.url:http://localhost:7860}")
    private String localModelUrl;
    
    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping("/generate-from-text")
    public ResponseEntity<String> generate3DFromText(@RequestBody Map<String, String> request) {
        String imageUrl = null;
        
        try {
            String prompt = request.get("prompt");
            
            if (prompt == null || prompt.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("{\"error\": \"No prompt provided\"}");
            }

            // Step 1: Generate image from text using local model with 3D-optimized prompt
            byte[] imageBytes = generateImageFromText(prompt.trim());
            
            if (imageBytes == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("{\"error\": \"Failed to generate image from text\"}");
            }

            // Save the generated image and get URL
            imageUrl = saveGeneratedImage(imageBytes);
            logger.info("Generated image URL: {}", imageUrl);

            // Step 2: Send generated image to TripoSR for 3D generation
            try {
                String response = generate3DFromImage(imageBytes, "generated_image.png");
                
                // Add the generated image URL to the response
                if (response != null) {
                    logger.info("Original 3D response: {}", response);
                    
                    // Clean the response and ensure proper JSON formatting
                    String cleanedResponse = response.replace("<EOL>", "").replace("\n", "").trim();
                    
                    // Simple string replacement to add image URL - fix the JSON properly
                    if (cleanedResponse.endsWith("}")) {
                        // Remove the last } and add our fields, then close with }
                        String withoutLastBrace = cleanedResponse.substring(0, cleanedResponse.lastIndexOf("}"));
                        response = withoutLastBrace + 
                                 ", \"generated_image_url\": \"" + imageUrl + 
                                 "\", \"prompt\": \"" + prompt.replace("\"", "'") + "\"}";
                    } else {
                        response = "{\"generated_image_url\": \"" + imageUrl + 
                                 "\", \"prompt\": \"" + prompt.replace("\"", "'") + 
                                 "\", \"response\": " + cleanedResponse + "}";
                    }
                    
                    logger.info("Modified 3D response: {}", response);
                    return ResponseEntity.ok(response);
                } else {
                    // 3D failed but we have the image
                    String errorResponse = "{\"error\": \"3D generation failed\", \"generated_image_url\": \"" + imageUrl + "\", \"prompt\": \"" + prompt + "\"}";
                    return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).body(errorResponse);
                }
                
            } catch (Exception e3d) {
                logger.error("3D generation failed: {}", e3d.getMessage());
                
                // Return image even if 3D fails
                String errorResponse = "{\"error\": \"3D generation failed: " + e3d.getMessage().replace("\"", "'") + "\", \"generated_image_url\": \"" + imageUrl + "\", \"prompt\": \"" + prompt + "\"}";
                return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).body(errorResponse);
            }

        } catch (Exception e) {
            logger.error("Failed to generate 3D model: {}", e.getMessage());
            
            // Create error response with image if available
            String errorResponse;
            if (imageUrl != null) {
                errorResponse = "{\"error\": \"Failed to generate 3D model: " + e.getMessage().replace("\"", "'") + "\", \"generated_image_url\": \"" + imageUrl + "\"}";
            } else {
                errorResponse = "{\"error\": \"Failed to generate 3D model: " + e.getMessage().replace("\"", "'") + "\"}";
            }
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Optimizes prompt specifically for 3D model generation
     * Ensures clean backgrounds and subject fully in frame
     */
    private String optimize3DPrompt(String originalPrompt) {
        String lowerPrompt = originalPrompt.toLowerCase();
        
        // Base enhancements for all 3D prompts
        String baseEnhancement = ", isolated object, centered, white background, studio lighting, " +
                               "3D model reference, clean composition, no background elements, " +
                               "product photography style, professional lighting, detailed, high quality, " +
                               "full object visible, complete subject, fully in frame, not cropped, " +
                               "entire object shown, wide shot, nothing cut off";
        
        // Category-specific optimizations - COMBINED clean backgrounds + full framing
        String categoryEnhancement = "";
        
        if (lowerPrompt.contains("car") || lowerPrompt.contains("vehicle") || 
            lowerPrompt.contains("truck") || lowerPrompt.contains("motorcycle") ||
            lowerPrompt.contains("sports car")) {
            categoryEnhancement = ", side view, automotive photography, metallic finish, " +
                                "no road, no environment, complete vehicle fully visible, entire car in frame";
        }
        else if (lowerPrompt.contains("ship") || lowerPrompt.contains("boat") || 
                 lowerPrompt.contains("sailing")) {
            categoryEnhancement = ", side view, naval vessel, no water, no ocean, no sea, " +
                                "complete ship fully visible, entire vessel in frame";
        }
        else if (lowerPrompt.contains("robot") || lowerPrompt.contains("character") || 
                 lowerPrompt.contains("armor")) {
            categoryEnhancement = ", full body, standing pose, front view, character design, " +
                                "complete figure fully visible, entire character in frame";
        }
        else if (lowerPrompt.contains("chair") || lowerPrompt.contains("table") || 
                 lowerPrompt.contains("furniture")) {
            categoryEnhancement = ", furniture photography, isometric view, no room, no environment, " +
                                "complete furniture piece fully visible, entire item in frame";
        }
        else if (lowerPrompt.contains("house") || lowerPrompt.contains("building") || 
                 lowerPrompt.contains("tower") || lowerPrompt.contains("castle")) {
            categoryEnhancement = ", architectural model, front elevation, no landscape, no surroundings, " +
                                "complete building fully visible, entire structure in frame";
        }
        else if (lowerPrompt.contains("animal") || lowerPrompt.contains("cat") || 
                 lowerPrompt.contains("dog") || lowerPrompt.contains("bird")) {
            categoryEnhancement = ", animal photography, side profile, natural pose, no habitat, no environment, " +
                                "full body animal fully visible, entire creature in frame";
        }
        else if (lowerPrompt.contains("plane") || lowerPrompt.contains("aircraft") || 
                 lowerPrompt.contains("airplane")) {
            categoryEnhancement = ", aircraft photography, side view, no sky, no clouds, no background, " +
                                "complete aircraft fully visible, entire plane in frame";
        }
        
        String optimizedPrompt = originalPrompt + baseEnhancement + categoryEnhancement;
        
        logger.info("Original prompt: {}", originalPrompt);
        logger.info("Optimized 3D prompt: {}", optimizedPrompt);
        
        return optimizedPrompt;
    }

    /**
     * Gets negative prompt for 3D generation to avoid unwanted elements and cropping
     */
    private String get3DNegativePrompt() {
        return "blurry, low quality, multiple objects, cluttered background, " +
               "dark shadows, cut off edges, partial view, cropped, text, watermark, " +
               "busy background, poor lighting, distorted, abstract, environment, " +
               "landscape, sky, clouds, water, ocean, sea, road, street, grass, " +
               "trees, buildings in background, people in background, " +
               "multiple views, collage, montage, split screen, complex scene, " +
               "cropped out, cut off, partial object, incomplete, truncated, " +
               "edges cut, frame cutting, not fully visible, missing parts";
    }

    private byte[] generateImageFromText(String prompt) {
        try {
            // Optimize prompt specifically for 3D generation
            String optimized3DPrompt = optimize3DPrompt(prompt);
            String negativePrompt = get3DNegativePrompt();
            
            logger.info("Generating image with local model for 3D: {}", optimized3DPrompt);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("prompt", optimized3DPrompt);
            requestBody.put("negative_prompt", negativePrompt);
            requestBody.put("steps", 10);  // Keep original steps
            requestBody.put("width", 512);
            requestBody.put("height", 512);
            requestBody.put("cfg_scale", 7.5);  // Slightly higher for better prompt adherence
            requestBody.put("sampler_name", "DPM++ 2M Karras");  // Better sampler for clean images

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            logger.info("Sending request to local model for 3D pipeline, waiting for completion...");
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                localModelUrl + "/sdapi/v1/txt2img",
                HttpMethod.POST,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                Object images = responseBody.get("images");
                
                if (images instanceof List<?> imagesList && !imagesList.isEmpty()) {
                    String base64Image = (String) imagesList.get(0);
                    return Base64.getDecoder().decode(base64Image);
                }
            }

            return null;

        } catch (Exception e) {
            logger.error("Error generating image with local model: {}", e.getMessage());
            return null;
        }
    }

    private String saveGeneratedImage(byte[] imageBytes) {
        try {
            String filename = "3d_" + System.currentTimeMillis() + ".png";
            String filepath = "generated-images/" + filename;
            
            try (FileOutputStream fos = new FileOutputStream(filepath)) {
                fos.write(imageBytes);
            }
            
            logger.info("Saved 3D source image to: {}", filepath);
            return "http://localhost:8080/api/images/" + filename;
            
        } catch (Exception e) {
            logger.error("Failed to save 3D source image", e);
            return null;
        }
    }

    private String generate3DFromImage(byte[] imageBytes, String filename) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", new ByteArrayResource(imageBytes) {
                @Override
                public String getFilename() {
                    return "generated_image.png";  // Use fixed filename for TripoSR
                }
            });

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            String response = restTemplate.postForObject(
                TRIPOSR_API_URL + "/generate-3d", 
                requestEntity, 
                String.class
            );

            return response;

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate 3D model from image: " + e.getMessage());
        }
    }

    @PostMapping("/generate")
    public ResponseEntity<String> generate3DModel(@RequestParam("image") MultipartFile imageFile) {
        try {
            if (imageFile.isEmpty()) {
                return ResponseEntity.badRequest().body("{\"error\": \"No image file provided\"}");
            }

            String contentType = imageFile.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                return ResponseEntity.badRequest().body("{\"error\": \"File must be an image\"}");
            }

            String response = generate3DFromImage(imageFile.getBytes(), imageFile.getOriginalFilename());

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("{\"error\": \"Failed to process image: " + e.getMessage() + "\"}");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("{\"error\": \"Failed to generate 3D model: " + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/download/{requestId}/{filename}")
    public ResponseEntity<Resource> downloadModel(
            @PathVariable String requestId, 
            @PathVariable String filename) {
        try {
            String downloadUrl = TRIPOSR_API_URL + "/download/" + requestId + "/" + filename;
            
            ResponseEntity<byte[]> response = restTemplate.getForEntity(downloadUrl, byte[].class);
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                ByteArrayResource resource = new ByteArrayResource(response.getBody());
                
                String contentType = getContentType(filename);
                
                return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/models")
    public ResponseEntity<String> listModels() {
        try {
            String response = restTemplate.getForObject(
                TRIPOSR_API_URL + "/list-models", 
                String.class
            );

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("{\"error\": \"Failed to fetch models: " + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        try {
            String response = restTemplate.getForObject(
                TRIPOSR_API_URL + "/health", 
                String.class
            );

            return ResponseEntity.ok(
                "{\"java_api\": \"healthy\", \"triposr_api\": \"healthy\", \"response\": " + response + "}"
            );

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body("{\"java_api\": \"healthy\", \"triposr_api\": \"unhealthy\", \"error\": \"" + e.getMessage() + "\"}");
        }
    }

    private String getContentType(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "application/octet-stream";
        }
        
        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        return switch (extension) {
            case "obj" -> "model/obj";
            case "ply" -> "model/ply";
            case "glb" -> "model/gltf-binary";
            case "fbx" -> "model/fbx";
            default -> "application/octet-stream";
        };
    }
}
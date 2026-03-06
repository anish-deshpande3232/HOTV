import tensorflow as tf
import numpy as np
import os
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input, decode_predictions

print("Loading AI model...")

# Load pretrained model
model = MobileNetV2(weights="imagenet")

print("Model loaded successfully")

# Get current script directory
base_dir = os.path.dirname(__file__)

# Image file
img_path = os.path.join(base_dir, "test.jpg")

print("Looking for image at:", img_path)

# Check if file exists
if not os.path.exists(img_path):
    print("ERROR: Image not found.")
    exit()

# Load image
img = image.load_img(img_path, target_size=(224,224))

# Convert image to array
img_array = image.img_to_array(img)

# Expand dimensions
img_array = np.expand_dims(img_array, axis=0)

# Preprocess image
img_array = preprocess_input(img_array)

print("Running AI prediction...")

# Predict
predictions = model.predict(img_array)

# Decode predictions
decoded = decode_predictions(predictions, top=3)[0]

print("\nTop predictions:\n")

for label in decoded:
    name = label[1]
    confidence = label[2] * 100
    print(f"{name} : {confidence:.2f}%")
import tensorflow as tf
import numpy as np
import os
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input, decode_predictions

IMG_SIZE = 224

print("Loading AI plant detector...")

# load pretrained model
model = MobileNetV2(weights="imagenet")

print("Model loaded")

# get script directory
base_dir = os.path.dirname(__file__)

# image file
img_path = os.path.join(base_dir, "test.jpg")

print("Reading image:", img_path)

if not os.path.exists(img_path):
    print("ERROR: test.jpg not found in this folder")
    exit()

# load image
img = image.load_img(img_path, target_size=(IMG_SIZE, IMG_SIZE))

# convert to array
img_array = image.img_to_array(img)

# expand dimensions
img_array = np.expand_dims(img_array, axis=0)

# preprocess
img_array = preprocess_input(img_array)

print("Running prediction...")

# predict
predictions = model.predict(img_array)

# decode results
results = decode_predictions(predictions, top=5)[0]

print("\nTop predictions:\n")

for r in results:
    label = r[1]
    confidence = r[2] * 100
    print(f"{label} : {confidence:.2f}%")
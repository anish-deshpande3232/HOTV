import cv2
import tensorflow as tf
import numpy as np

# Load trained model
model = tf.keras.models.load_model("plant_model.h5")

# Class labels (must match dataset folder names)
classes = ["turmeric", "ginger", "neem"]

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()

    img = cv2.resize(frame, (224,224))
    img = img/255.0
    img = np.expand_dims(img, axis=0)

    prediction = model.predict(img)
    class_id = np.argmax(prediction)

    label = classes[class_id]

    cv2.putText(frame, label, (20,40),
                cv2.FONT_HERSHEY_SIMPLEX,1,(0,255,0),2)

    cv2.imshow("Plant Detector", frame)

    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()
import json

import cv2
import numpy as np
import base64
import os

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.generic):
            return obj.item()
        return json.JSONEncoder.default(self, obj)


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def dump_json(obj, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, cls=NumpyEncoder)


def imread(path, flags=cv2.IMREAD_COLOR):
    """cv2.imread, but works with unicode paths"""
    return cv2.imdecode(np.fromfile(path, dtype=np.uint8), flags)


def get_manga_id(relevant_manga_path):
    return base64.urlsafe_b64encode(str(base_manga_path).encode("utf-8")).rstrip(b"=").decode('utf-8')
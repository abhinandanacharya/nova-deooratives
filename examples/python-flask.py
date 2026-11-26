"""
Example: Python (Flask) Controller -> View with nova-deooratives
Run: pip install flask && python examples/python-flask.py
"""
import json
from flask import Flask, render_template_string

app = Flask(__name__)

TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{{ title }}</title>
  <script src="https://cdn.jsdelivr.net/npm/nova-deooratives/dist/mylang.umd.min.js"></script>
</head>
<body>
  <script type="text/mylang" data-scope='{{ payload | safe }}'>
    <h1>{{ title }}</h1>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><th>#</th><th>Product</th><th>Price</th><th>Stock</th></tr>
      <for of="products" as="p" index="i">
        <tr>
          <td>{{ i + 1 }}</td>
          <td>{{ p.name }}</td>
          <td>${{ p.price }}</td>
          <td>
            <if cond="p.stock > 0">
              <span>In Stock ({{ p.stock }})</span>
              <else><span>Out of Stock</span></else>
            </if>
          </td>
        </tr>
      </for>
    </table>
  </script>
</body>
</html>
"""

@app.route("/")
def index():
    products = [
        {"name": "Keyboard", "price": 79, "stock": 12},
        {"name": "Mouse",    "price": 39, "stock": 0},
        {"name": "Monitor",  "price": 299, "stock": 5},
    ]
    payload = json.dumps({"title": "Inventory", "products": products})
    return render_template_string(TEMPLATE, title="Inventory", payload=payload)

if __name__ == "__main__":
    app.run(debug=True, port=5000)

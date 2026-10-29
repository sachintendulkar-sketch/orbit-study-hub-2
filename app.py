"""Orbit Study Hub: Flask application entry point.

Run locally:   python app.py
Run on Render: gunicorn app:app
"""
import os
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    @app.route("/")
    def home():
        return render_template("index.html", app_name="Orbit Study Hub")

    @app.route("/health")
    def health():
        # Handy for Render's optional health check path.
        return jsonify(status="ok"), 200

    @app.route("/api/status")
    def status():
        return jsonify(
            app="Orbit Study Hub",
            status="live",
            time_utc=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        )

    @app.errorhandler(404)
    def not_found(_error):
        return render_template("index.html", app_name="Orbit Study Hub"), 404

    return app


# Module-level object so `gunicorn app:app` can find it.
app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

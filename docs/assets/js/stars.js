/**
 * Shooting Stars and Stars Background
 * Optimized Canvas Animation
 */

class Star {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.size = Math.random() * 1.5;
        this.opacity = Math.random();
        this.speed = Math.random() * 0.05;
    }

    update() {
        this.opacity += this.speed;
        if (this.opacity > 1 || this.opacity < 0) {
            this.speed = -this.speed;
        }
    }

    draw() {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

class ShootingStar {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
        this.active = false;
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = 0;
        this.len = Math.random() * 80 + 10;
        this.speed = Math.random() * 10 + 5;
        this.size = Math.random() * 1 + 0.1;
        this.waitTime = new Date().getTime() + (Math.random() * 3000 + 500);
        this.active = false;
    }

    update() {
        if (this.active) {
            this.x -= this.speed;
            this.y += this.speed;
            if (this.x < 0 || this.y > this.canvas.height) {
                this.reset();
            }
        } else {
            if (new Date().getTime() > this.waitTime) {
                this.active = true;
            }
        }
    }

    draw() {
        if (!this.active) return;

        const gradient = this.ctx.createLinearGradient(this.x, this.y, this.x + this.len, this.y - this.len);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = this.size;
        this.ctx.beginPath();
        this.ctx.moveTo(this.x, this.y);
        this.ctx.lineTo(this.x + this.len, this.y - this.len);
        this.ctx.stroke();
    }
}

class StarBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.shootingStars = [];
        this.starCount = 150;
        this.shootingStarCount = 5;

        this.init();
        this.animate();

        window.addEventListener('resize', () => this.init());
    }

    init() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.stars = [];
        for (let i = 0; i < this.starCount; i++) {
            this.stars.push(new Star(this.canvas));
        }

        this.shootingStars = [];
        for (let i = 0; i < this.shootingStarCount; i++) {
            this.shootingStars.push(new ShootingStar(this.canvas));
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Dark background (only if we want the canvas to handle it, but we use CSS)
        // this.ctx.fillStyle = '#0f172a';
        // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.stars.forEach(star => {
            star.update();
            star.draw();
        });

        this.shootingStars.forEach(sStar => {
            sStar.update();
            sStar.draw();
        });

        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StarBackground('star-canvas');
});

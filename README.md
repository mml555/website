[![Coverage Status](https://raw.githubusercontent.com/mml555/website/main/coverage-badge.svg)](https://github.com/mml555/website/actions/workflows/coverage-badge.yml)

# E-Commerce Web Application

A modern, full-stack e-commerce platform built with Next.js, React, TypeScript, and Prisma. This project demonstrates a robust architecture for scalable online stores, featuring authentication, product management, cart, checkout, and more.

---

## 🚀 Tech Stack
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Prisma ORM, PostgreSQL
- **Testing:** Jest
- **CI/CD:** GitHub Actions
- **Code Quality:** ESLint, Prettier

---

## 📦 Features
- User authentication (register, login, password reset)
- Product catalog and categories
- Shopping cart and checkout
- Order management
- Admin dashboard
- Wishlist
- Email notifications
- Responsive design

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- PostgreSQL database

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_REPO.git
   cd YOUR_REPO
   ```
2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```
3. **Set up environment variables:**
   - Copy `.env.example` to `.env` and fill in the required values.
4. **Run database migrations:**
   ```bash
   npx prisma migrate dev
   ```
5. **Start the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

---

## 🧪 Testing
- Run all tests:
  ```bash
  npm test
  # or
  yarn test
  ```
- View coverage report:
  ```bash
  npm run coverage
  ```

---

## 🤝 Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Open a pull request

---

## 📄 License
This project is licensed under the MIT License.

---

## 📬 Contact
For questions or support, please open an issue or contact the maintainer.

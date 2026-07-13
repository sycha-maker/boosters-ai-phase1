import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ALLOWED_DOMAIN = "boosters.kr";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // boosters.kr 계정만 로그인 허용 (Google OAuth 동의 화면을 "내부"로 설정해뒀어도,
    // 코드 레벨에서 한 번 더 도메인을 검증해 이중으로 막는다)
    async signIn({ profile }) {
      const email = (profile?.email || "").toLowerCase();
      const hd = profile?.hd;
      if (hd === ALLOWED_DOMAIN) return true;
      if (email.endsWith(`@${ALLOWED_DOMAIN}`)) return true;
      return false;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    // 도메인 제한에 걸려 로그인 거부된 경우에도 기본 에러 페이지 대신 우리 로그인 화면으로 돌아오게 함
    error: "/",
  },
});

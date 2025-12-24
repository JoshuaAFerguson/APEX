class Apex < Formula
  desc "APEX - AI-powered development team automation CLI"
  homepage "https://github.com/JoshuaAFerguson/apex"
  url "https://github.com/JoshuaAFerguson/apex/archive/refs/tags/v0.3.0.tar.gz"
  sha256 "REPLACE_WITH_REAL_SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/apex", "--version"
  end
end

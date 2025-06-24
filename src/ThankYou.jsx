
export default function ThankYou() {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white p-8 text-center">
      <h1 className="text-3xl font-bold mb-4">🎉 Thank You!</h1>
      <p className="text-lg max-w-md">
        Your drawing was submitted successfully. If it's selected, it will appear on the main site
        with your name at the bottom right. Thanks for contributing!
      </p>
    </div>
  );
}

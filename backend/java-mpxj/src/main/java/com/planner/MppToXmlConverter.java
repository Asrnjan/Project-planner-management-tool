package com.planner;

import java.io.File;

import org.mpxj.ProjectFile;
import org.mpxj.reader.UniversalProjectReader;
import org.mpxj.writer.FileFormat;
import org.mpxj.writer.UniversalProjectWriter;

public class MppToXmlConverter {
    public static void main(String[] args) {
        try {
            if (args.length < 2) {
                System.err.println("Usage: MppToXmlConverter <input.mpp> <output.xml>");
                System.exit(1);
            }

            String inputPath = args[0];
            String outputPath = args[1];

            File inputFile = new File(inputPath);
            File outputFile = new File(outputPath);

            if (!inputFile.exists()) {
                System.err.println("Input file does not exist: " + inputPath);
                System.exit(1);
            }

            ProjectFile project = new UniversalProjectReader().read(inputFile.getAbsolutePath());

            new UniversalProjectWriter(FileFormat.MSPDI).write(
                project,
                outputFile.getAbsolutePath()
            );

            System.out.println("Converted successfully: " + outputFile.getAbsolutePath());
        } catch (Exception error) {
            error.printStackTrace();
            System.exit(1);
        }
    }
}